import { create } from 'zustand';
import type { HistoryEntry, EditSnapshot } from './types';
import { MAX_HISTORY } from './types';
import { saveHistory, deleteHistory, loadHistory } from '../lib/history-db';

type PhotoHistory = {
  entries: HistoryEntry[];
  currentIndex: number;
};

type HistoryStore = {
  historyByPhoto: Record<string, PhotoHistory>;
  /** True while applying a snapshot — stores should skip recording */
  isApplying: boolean;
  /** Track which photos have been loaded from IndexedDB */
  loadedPhotos: Set<string>;

  getHistory: (photoId: string) => PhotoHistory;
  restoreHistory: (photoId: string) => Promise<PhotoHistory>;
  push: (photoId: string, label: string, details: string, snapshot: EditSnapshot) => void;
  undo: (photoId: string) => EditSnapshot | null;
  redo: (photoId: string) => EditSnapshot | null;
  canUndo: (photoId: string) => boolean;
  canRedo: (photoId: string) => boolean;
  setIsApplying: (v: boolean) => void;
  clearPhoto: (photoId: string) => void;
};

const EMPTY_HISTORY: PhotoHistory = { entries: [], currentIndex: -1 };

const SAVE_DEBOUNCE_MS = 1000;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedSave(photoId: string, history: PhotoHistory) {
  const existing = saveTimers.get(photoId);
  if (existing) clearTimeout(existing);
  saveTimers.set(
    photoId,
    setTimeout(() => {
      saveTimers.delete(photoId);
      saveHistory(photoId, history);
    }, SAVE_DEBOUNCE_MS),
  );
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  historyByPhoto: {},
  isApplying: false,
  loadedPhotos: new Set(),

  getHistory: (photoId) => get().historyByPhoto[photoId] ?? EMPTY_HISTORY,

  restoreHistory: async (photoId) => {
    const state = get();
    if (state.loadedPhotos.has(photoId)) {
      return state.historyByPhoto[photoId] ?? EMPTY_HISTORY;
    }

    const saved = await loadHistory(photoId);
    const loaded = saved ?? EMPTY_HISTORY;

    set((s) => {
      const newLoaded = new Set(s.loadedPhotos);
      newLoaded.add(photoId);
      // Only set if not already populated (avoid overwriting in-progress edits)
      if (s.historyByPhoto[photoId]) {
        return { loadedPhotos: newLoaded };
      }
      return {
        loadedPhotos: newLoaded,
        historyByPhoto: { ...s.historyByPhoto, [photoId]: loaded },
      };
    });

    return get().historyByPhoto[photoId] ?? EMPTY_HISTORY;
  },

  push: (photoId, label, details, snapshot) =>
    set((s) => {
      const prev = s.historyByPhoto[photoId] ?? { ...EMPTY_HISTORY };
      // Branch cut: discard entries after currentIndex
      const entries = prev.entries.slice(0, prev.currentIndex + 1);
      entries.push({ label, details, timestamp: Date.now(), snapshot });
      // Enforce max limit
      if (entries.length > MAX_HISTORY) entries.shift();
      const updated = { entries, currentIndex: entries.length - 1 };
      debouncedSave(photoId, updated);
      return {
        historyByPhoto: {
          ...s.historyByPhoto,
          [photoId]: updated,
        },
      };
    }),

  undo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    if (!h || h.currentIndex <= 0) return null;
    const newIndex = h.currentIndex - 1;
    const updated = { ...h, currentIndex: newIndex };
    set((s) => ({
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: updated,
      },
    }));
    debouncedSave(photoId, updated);
    return h.entries[newIndex].snapshot;
  },

  redo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    if (!h || h.currentIndex >= h.entries.length - 1) return null;
    const newIndex = h.currentIndex + 1;
    const updated = { ...h, currentIndex: newIndex };
    set((s) => ({
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: updated,
      },
    }));
    debouncedSave(photoId, updated);
    return h.entries[newIndex].snapshot;
  },

  canUndo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    return !!h && h.currentIndex > 0;
  },

  canRedo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    return !!h && h.currentIndex < h.entries.length - 1;
  },

  setIsApplying: (isApplying) => set({ isApplying }),

  clearPhoto: (photoId) => {
    deleteHistory(photoId);
    set((s) => {
      const { [photoId]: _, ...rest } = s.historyByPhoto;
      const newLoaded = new Set(s.loadedPhotos);
      newLoaded.delete(photoId);
      return { historyByPhoto: rest, loadedPhotos: newLoaded };
    });
  },
}));
