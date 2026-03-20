import { create } from 'zustand';
import type { HistoryEntry, EditSnapshot } from './types';
import { MAX_HISTORY } from './types';

type PhotoHistory = {
  entries: HistoryEntry[];
  currentIndex: number;
};

type HistoryStore = {
  historyByPhoto: Record<string, PhotoHistory>;
  /** True while applying a snapshot — stores should skip recording */
  isApplying: boolean;

  getHistory: (photoId: string) => PhotoHistory;
  push: (photoId: string, label: string, details: string, snapshot: EditSnapshot) => void;
  undo: (photoId: string) => EditSnapshot | null;
  redo: (photoId: string) => EditSnapshot | null;
  canUndo: (photoId: string) => boolean;
  canRedo: (photoId: string) => boolean;
  setIsApplying: (v: boolean) => void;
  clearPhoto: (photoId: string) => void;
};

const EMPTY_HISTORY: PhotoHistory = { entries: [], currentIndex: -1 };

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  historyByPhoto: {},
  isApplying: false,

  getHistory: (photoId) => get().historyByPhoto[photoId] ?? EMPTY_HISTORY,

  push: (photoId, label, details, snapshot) => set((s) => {
    const prev = s.historyByPhoto[photoId] ?? { ...EMPTY_HISTORY };
    // Branch cut: discard entries after currentIndex
    const entries = prev.entries.slice(0, prev.currentIndex + 1);
    entries.push({ label, details, timestamp: Date.now(), snapshot });
    // Enforce max limit
    if (entries.length > MAX_HISTORY) entries.shift();
    return {
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: { entries, currentIndex: entries.length - 1 },
      },
    };
  }),

  undo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    if (!h || h.currentIndex <= 0) return null;
    const newIndex = h.currentIndex - 1;
    set((s) => ({
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: { ...h, currentIndex: newIndex },
      },
    }));
    return h.entries[newIndex].snapshot;
  },

  redo: (photoId) => {
    const h = get().historyByPhoto[photoId];
    if (!h || h.currentIndex >= h.entries.length - 1) return null;
    const newIndex = h.currentIndex + 1;
    set((s) => ({
      historyByPhoto: {
        ...s.historyByPhoto,
        [photoId]: { ...h, currentIndex: newIndex },
      },
    }));
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

  clearPhoto: (photoId) => set((s) => {
    const { [photoId]: _, ...rest } = s.historyByPhoto;
    return { historyByPhoto: rest };
  }),
}));
