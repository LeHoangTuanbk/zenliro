import { create } from 'zustand';
import type { GradingRange, WheelState } from './types';
import { defaultWheel } from './types';

type ColorGradingStore = {
  shadows: WheelState;
  midtones: WheelState;
  highlights: WheelState;
  blending: number;
  balance: number;
  setWheel: (range: GradingRange, patch: Partial<WheelState>) => void;
  setBlending: (v: number) => void;
  setBalance: (v: number) => void;
  reset: () => void;
};

export const useColorGradingStore = create<ColorGradingStore>((set) => ({
  shadows: defaultWheel(),
  midtones: defaultWheel(),
  highlights: defaultWheel(),
  blending: 50,
  balance: 0,
  setWheel: (range, patch) =>
    set((s) => ({ [range]: { ...s[range], ...patch } })),
  setBlending: (blending) => set({ blending }),
  setBalance: (balance) => set({ balance }),
  reset: () =>
    set({
      shadows: defaultWheel(),
      midtones: defaultWheel(),
      highlights: defaultWheel(),
      blending: 50,
      balance: 0,
    }),
}));
