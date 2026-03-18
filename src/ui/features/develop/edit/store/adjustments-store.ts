import { create } from 'zustand';

export interface Adjustments {
  // White Balance
  temp: number; // -100 to 100
  tint: number; // -100 to 100
  // Light
  exposure: number; // -5 to 5
  contrast: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  whites: number; // -100 to 100
  blacks: number; // -100 to 100
  // Presence
  texture: number; // -100 to 100
  clarity: number; // -100 to 100
  dehaze: number; // -100 to 100
  vibrance: number; // -100 to 100
  saturation: number; // -100 to 100
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  temp: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  vibrance: 0,
  saturation: 0,
};

type AdjustmentsStore = {
  adjustments: Adjustments;
  setAdjustment: <K extends keyof Adjustments>(key: K, value: Adjustments[K]) => void;
  resetAdjustment: (key: keyof Adjustments) => void;
  resetAll: () => void;
};

export const useAdjustmentsStore = create<AdjustmentsStore>((set) => ({
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  setAdjustment: (key, value) =>
    set((state) => ({
      adjustments: { ...state.adjustments, [key]: value },
    })),
  resetAdjustment: (key) =>
    set((state) => ({
      adjustments: { ...state.adjustments, [key]: DEFAULT_ADJUSTMENTS[key] },
    })),
  resetAll: () => set({ adjustments: { ...DEFAULT_ADJUSTMENTS } }),
}));
