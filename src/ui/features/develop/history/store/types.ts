import type { Adjustments } from '@features/develop/edit/store/adjustments-store';
import type {
  CurveChannel,
  CurvePoint,
  ParametricPerChannel,
} from '@features/develop/edit/tone-curve/store/types';
import type { ChannelValues } from '@features/develop/edit/color-mixer/store/types';
import type { WheelState } from '@features/develop/edit/color-grading/store/types';
import type { EffectsState } from '@features/develop/edit/effects/model/effects-store';
import type { CropState } from '@features/develop/crop/store/types';
import type { HealSpot } from '@features/develop/heal/store/types';
import type { Mask } from '@features/develop/mask';

export const MAX_HISTORY = 100;

export type EditSnapshot = {
  adjustments: Adjustments;
  toneCurve: {
    points: Record<CurveChannel, CurvePoint[]>;
    parametric: ParametricPerChannel;
  };
  colorMixer: {
    hue: ChannelValues;
    saturation: ChannelValues;
    luminance: ChannelValues;
  };
  colorGrading: {
    shadows: WheelState;
    midtones: WheelState;
    highlights: WheelState;
    blending: number;
    balance: number;
  };
  effects: EffectsState;
  crop: CropState;
  healSpots: HealSpot[];
  masks: Mask[];
};

export type HistoryEntry = {
  label: string;
  details: string;
  timestamp: number;
  snapshot: EditSnapshot;
};
