import { create } from 'zustand';
import type {
  CurveChannel,
  CurvePoint,
  ParametricSliders,
  ParametricPerChannel,
  ZoneSplits,
} from './types';
import { defaultCurvePoints, defaultParametricPerChannel, DEFAULT_ZONE_SPLITS } from './types';

type ToneCurveStore = {
  channel: CurveChannel;
  points: Record<CurveChannel, CurvePoint[]>;
  parametric: ParametricPerChannel;
  zoneSplits: ZoneSplits;
  setChannel: (ch: CurveChannel) => void;
  setPoints: (ch: CurveChannel, pts: CurvePoint[]) => void;
  setParametric: (ch: CurveChannel, key: keyof ParametricSliders, value: number) => void;
  setZoneSplits: (splits: ZoneSplits) => void;
  reset: () => void;
};

export const useToneCurveStore = create<ToneCurveStore>((set) => ({
  channel: 'rgb',
  points: defaultCurvePoints(),
  parametric: defaultParametricPerChannel(),
  zoneSplits: [...DEFAULT_ZONE_SPLITS],
  setChannel: (ch) => set({ channel: ch }),
  setPoints: (ch, pts) => set((state) => ({ points: { ...state.points, [ch]: pts } })),
  setParametric: (ch, key, value) =>
    set((state) => ({
      parametric: {
        ...state.parametric,
        [ch]: { ...state.parametric[ch], [key]: value },
      },
    })),
  setZoneSplits: (splits) => set({ zoneSplits: splits }),
  reset: () =>
    set({
      points: defaultCurvePoints(),
      parametric: defaultParametricPerChannel(),
      zoneSplits: [...DEFAULT_ZONE_SPLITS],
    }),
}));
