import { create } from 'zustand';
import type { CurveChannel, CurvePoint, ParametricSliders } from './types';
import { defaultCurvePoints, defaultParametric } from './types';

type ToneCurveStore = {
  channel: CurveChannel;
  points: Record<CurveChannel, CurvePoint[]>;
  parametric: ParametricSliders;
  setChannel: (ch: CurveChannel) => void;
  setPoints: (ch: CurveChannel, pts: CurvePoint[]) => void;
  setParametric: (key: keyof ParametricSliders, value: number) => void;
  reset: () => void;
};

export const useToneCurveStore = create<ToneCurveStore>((set) => ({
  channel: 'rgb',
  points: defaultCurvePoints(),
  parametric: defaultParametric(),
  setChannel: (ch) => set({ channel: ch }),
  setPoints: (ch, pts) =>
    set((state) => ({ points: { ...state.points, [ch]: pts } })),
  setParametric: (key, value) =>
    set((state) => ({ parametric: { ...state.parametric, [key]: value } })),
  reset: () => set({ points: defaultCurvePoints(), parametric: defaultParametric() }),
}));
