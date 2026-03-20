import { useAdjustmentsStore } from '@features/develop/edit/store/adjustments-store';
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import { useEffectsStore } from '@features/develop/edit/effects/model/effects-store';
import { useCropStore } from '@features/develop/crop/store/crop-store';
import { DEFAULT_CROP_STATE } from '@features/develop/crop/store/types';
import { useHealStore } from '@features/develop/heal/store/heal-store';
import { useMaskStore } from '@/features/develop/mask';
import type { EditSnapshot } from '../store/types';

export function captureSnapshot(photoId: string): EditSnapshot {
  const adj = useAdjustmentsStore.getState();
  const curve = useToneCurveStore.getState();
  const mixer = useColorMixerStore.getState();
  const grading = useColorGradingStore.getState();
  const effects = useEffectsStore.getState();
  const crop = useCropStore.getState().cropByPhoto[photoId] ?? DEFAULT_CROP_STATE;
  const healSpots = useHealStore.getState().getSpots(photoId);
  const masks = useMaskStore.getState().getMasks(photoId);

  return structuredClone({
    adjustments: adj.adjustments,
    toneCurve: { points: curve.points, parametric: curve.parametric },
    colorMixer: { hue: mixer.hue, saturation: mixer.saturation, luminance: mixer.luminance },
    colorGrading: {
      shadows: grading.shadows,
      midtones: grading.midtones,
      highlights: grading.highlights,
      blending: grading.blending,
      balance: grading.balance,
    },
    effects: {
      vigAmount: effects.vigAmount,
      vigMidpoint: effects.vigMidpoint,
      vigRoundness: effects.vigRoundness,
      vigFeather: effects.vigFeather,
      vigHighlights: effects.vigHighlights,
      grainAmount: effects.grainAmount,
      grainSize: effects.grainSize,
      grainRoughness: effects.grainRoughness,
    },
    crop,
    healSpots,
    masks,
  });
}

export function applySnapshot(photoId: string, snapshot: EditSnapshot) {
  const s = structuredClone(snapshot);

  useAdjustmentsStore.setState({ adjustments: s.adjustments });
  useToneCurveStore.setState({ points: s.toneCurve.points, parametric: s.toneCurve.parametric });
  useColorMixerStore.setState({
    hue: s.colorMixer.hue,
    saturation: s.colorMixer.saturation,
    luminance: s.colorMixer.luminance,
  });
  useColorGradingStore.setState({
    shadows: s.colorGrading.shadows,
    midtones: s.colorGrading.midtones,
    highlights: s.colorGrading.highlights,
    blending: s.colorGrading.blending,
    balance: s.colorGrading.balance,
  });
  useEffectsStore.setState(s.effects);
  useCropStore.getState().setCrop(photoId, s.crop);
  useHealStore.getState().clearAll(photoId);
  s.healSpots.forEach((spot) => useHealStore.getState().addSpot(photoId, spot));
  useMaskStore.getState().setMasksForPhoto(photoId, s.masks);
}
