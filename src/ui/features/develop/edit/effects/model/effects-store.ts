import { create } from 'zustand';

export type EffectsState = {
  // Post-Crop Vignetting
  vigAmount: number;      // -100 to 100
  vigMidpoint: number;    // 0 to 100
  vigRoundness: number;   // -100 to 100
  vigFeather: number;     // 0 to 100
  vigHighlights: number;  // 0 to 100
  // Grain
  grainAmount: number;    // 0 to 100
  grainSize: number;      // 0 to 100
  grainRoughness: number; // 0 to 100
};

type EffectsStore = EffectsState & {
  set: <K extends keyof EffectsState>(key: K, val: EffectsState[K]) => void;
  reset: () => void;
};

const DEFAULTS: EffectsState = {
  vigAmount: 0,
  vigMidpoint: 50,
  vigRoundness: 0,
  vigFeather: 50,
  vigHighlights: 0,
  grainAmount: 0,
  grainSize: 25,
  grainRoughness: 50,
};

export const useEffectsStore = create<EffectsStore>((setState) => ({
  ...DEFAULTS,
  set: (key, val) => setState({ [key]: val } as Partial<EffectsState>),
  reset: () => setState(DEFAULTS),
}));
