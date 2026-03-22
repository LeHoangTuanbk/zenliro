import { create } from 'zustand';

type CanvasZoomStore = {
  zoom: number;
  setZoom: (zoom: number) => void;
  resetZoom: (() => void) | null;
  setResetZoom: (fn: () => void) => void;
};

export const useCanvasZoomStore = create<CanvasZoomStore>((set) => ({
  zoom: 1,
  setZoom: (zoom) => set({ zoom }),
  resetZoom: null,
  setResetZoom: (fn) => set({ resetZoom: fn }),
}));
