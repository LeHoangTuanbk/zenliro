import { create } from 'zustand';

type CompareStore = {
  isCompareMode: boolean;
  zoom: number;
  pan: { x: number; y: number };
  toggle: () => void;
  setZoomPan: (zoom: number, pan: { x: number; y: number }) => void;
};

export const useCompareStore = create<CompareStore>((set) => ({
  isCompareMode: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  toggle: () => set((s) => ({ isCompareMode: !s.isCompareMode })),
  setZoomPan: (zoom, pan) => set({ zoom, pan }),
}));
