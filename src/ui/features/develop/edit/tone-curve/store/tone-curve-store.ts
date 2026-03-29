import { create } from 'zustand';
import type { CurveChannel, CurvePoint, ParametricSliders, ZoneSplits } from './types';
import { defaultCurvePoints, defaultParametric, DEFAULT_ZONE_SPLITS } from './types';

type ToneCurveStore = {
  channel: CurveChannel;
  points: Record<CurveChannel, CurvePoint[]>;
  parametric: ParametricSliders;
  zoneSplits: ZoneSplits;
  setChannel: (ch: CurveChannel) => void;
  setPoints: (ch: CurveChannel, pts: CurvePoint[]) => void;
  setParametric: (key: keyof ParametricSliders, value: number) => void;
  setZoneSplits: (splits: ZoneSplits) => void;
  reset: () => void;
};

export const useToneCurveStore = create<ToneCurveStore>((set) => ({
  channel: 'rgb',
  points: defaultCurvePoints(),
  parametric: defaultParametric(),
  zoneSplits: [...DEFAULT_ZONE_SPLITS],
  setChannel: (ch) => set({ channel: ch }),
  setPoints: (ch, pts) => set((state) => ({ points: { ...state.points, [ch]: pts } })),
  setParametric: (key, value) =>
    set((state) => ({ parametric: { ...state.parametric, [key]: value } })),
  setZoneSplits: (splits) => set({ zoneSplits: splits }),
  reset: () =>
    set({
      points: defaultCurvePoints(),
      parametric: defaultParametric(),
      zoneSplits: [...DEFAULT_ZONE_SPLITS],
    }),
}));
