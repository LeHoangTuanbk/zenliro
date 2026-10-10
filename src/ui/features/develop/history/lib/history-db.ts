import type { EditSnapshot, HistoryEntry } from '../store/types';

type PhotoHistory = {
  entries: HistoryEntry[];
  currentIndex: number;
};

/** Heavy snapshot parts that rarely change between steps — stored once, referenced by index. */
const POOLED_KEYS = ['masks', 'healSpots'] as const;
type PooledKey = (typeof POOLED_KEYS)[number];

const STORAGE_VERSION = 2;

type StoredSnapshot = Omit<EditSnapshot, PooledKey> & Record<PooledKey, number>;

type StoredHistory = {
  version: typeof STORAGE_VERSION;
  pools: Record<PooledKey, unknown[]>;
  entries: (Omit<HistoryEntry, 'snapshot'> & { snapshot: StoredSnapshot })[];
  currentIndex: number;
};

function encode(history: PhotoHistory): StoredHistory {
  const pools = { masks: [], healSpots: [] } as Record<PooledKey, unknown[]>;
  const indexOf = new Map<unknown, number>();
  const ref = (value: unknown, key: PooledKey) => {
    let i = indexOf.get(value);
    if (i === undefined) {
      i = pools[key].push(value) - 1;
      indexOf.set(value, i);
    }
    return i;
  };
  return {
    version: STORAGE_VERSION,
    pools,
    currentIndex: history.currentIndex,
    entries: history.entries.map((e) => ({
      ...e,
      snapshot: {
        ...e.snapshot,
        masks: ref(e.snapshot.masks, 'masks'),
        healSpots: ref(e.snapshot.healSpots, 'healSpots'),
      },
    })),
  };
}

function decode(stored: StoredHistory): PhotoHistory {
  const { pools } = stored;
  return {
    currentIndex: stored.currentIndex,
    entries: stored.entries.map((e) => ({
      ...e,
      snapshot: {
        ...e.snapshot,
        masks: pools.masks[e.snapshot.masks] as EditSnapshot['masks'],
        healSpots: pools.healSpots[e.snapshot.healSpots] as EditSnapshot['healSpots'],
      },
    })),
  };
}

/** Legacy files copied every part into every entry — share equal neighbours so the next save is small. */
function dedupeLegacy(history: PhotoHistory): PhotoHistory {
  const prevJson: Partial<Record<PooledKey, string>> = {};
  const prevValue: Partial<Record<PooledKey, unknown>> = {};
  for (const entry of history.entries) {
    for (const key of POOLED_KEYS) {
      const json = JSON.stringify(entry.snapshot[key]);
      if (json === prevJson[key])
        (entry.snapshot as Record<PooledKey, unknown>)[key] = prevValue[key];
      prevJson[key] = json;
      prevValue[key] = entry.snapshot[key];
    }
  }
  return history;
}

const isStored = (data: unknown): data is StoredHistory =>
  (data as StoredHistory | null)?.version === STORAGE_VERSION;

export async function loadHistory(photoId: string): Promise<PhotoHistory | null> {
  try {
    const data = await window.electron.history.load(photoId);
    if (!data) return null;
    return isStored(data) ? decode(data) : dedupeLegacy(data as PhotoHistory);
  } catch {
    return null;
  }
}

export async function saveHistory(photoId: string, history: PhotoHistory): Promise<void> {
  try {
    await window.electron.history.save(photoId, encode(history));
  } catch {
    // Best-effort persistence
  }
}

export async function deleteHistory(photoId: string): Promise<void> {
  try {
    await window.electron.history.delete(photoId);
  } catch {
    // Best-effort
  }
}
