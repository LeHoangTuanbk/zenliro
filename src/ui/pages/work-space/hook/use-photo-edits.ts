import { useEffect, useRef } from 'react';
import { useCatalogStore } from '../store/catalog-store';
import { useAdjustmentsStore, DEFAULT_ADJUSTMENTS } from '@features/develop/edit/store/adjustments-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { defaultChannelValues } from '@features/develop/edit/color-mixer/store/types';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import { defaultWheel } from '@features/develop/edit/color-grading/store/types';
import { useEffectsStore } from '@features/develop/edit/effects/model/effects-store';
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import {
  defaultCurvePoints,
  defaultParametric,
} from '@features/develop/edit/tone-curve/store/types';
import { useCropStore } from '@features/develop/crop/store/crop-store';

function captureEdits(photoId: string): PhotoEdits {
  const adj = useAdjustmentsStore.getState();
  const mixer = useColorMixerStore.getState();
  const grading = useColorGradingStore.getState();
  const effects = useEffectsStore.getState();
  const curve = useToneCurveStore.getState();
  const cropState = useCropStore.getState().cropByPhoto[photoId];

  return {
    adjustments: { ...adj.adjustments },
    colorMixer: {
      hue: { ...mixer.hue },
      saturation: { ...mixer.saturation },
      luminance: { ...mixer.luminance },
    },
    colorGrading: {
      shadows: { ...grading.shadows },
      midtones: { ...grading.midtones },
      highlights: { ...grading.highlights },
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
    toneCurve: {
      points: { ...curve.points },
      parametric: { ...curve.parametric },
    },
    ...(cropState
      ? {
          crop: {
            x: cropState.rect.x,
            y: cropState.rect.y,
            w: cropState.rect.w,
            h: cropState.rect.h,
            angle: cropState.rotation,
            aspectPreset: cropState.aspectPreset,
            lockAspect: cropState.lockAspect,
          },
        }
      : {}),
  };
}

function applyEdits(photoId: string, edits: PhotoEdits) {
  useAdjustmentsStore.setState({
    adjustments: { ...DEFAULT_ADJUSTMENTS, ...(edits.adjustments as never) },
  });

  const mixer = edits.colorMixer;
  useColorMixerStore.setState({
    hue: { ...defaultChannelValues(), ...mixer.hue },
    saturation: { ...defaultChannelValues(), ...mixer.saturation },
    luminance: { ...defaultChannelValues(), ...mixer.luminance },
  });

  const cg = edits.colorGrading;
  useColorGradingStore.setState({
    shadows: { ...defaultWheel(), ...cg.shadows },
    midtones: { ...defaultWheel(), ...cg.midtones },
    highlights: { ...defaultWheel(), ...cg.highlights },
    blending: cg.blending ?? 50,
    balance: cg.balance ?? 0,
  });

  useEffectsStore.setState({ ...(edits.effects as never) });

  useToneCurveStore.setState({
    points: { ...defaultCurvePoints(), ...edits.toneCurve.points } as never,
    parametric: { ...defaultParametric(), ...edits.toneCurve.parametric },
  });

  if (edits.crop) {
    useCropStore.getState().setCrop(photoId, {
      rect: { x: edits.crop.x, y: edits.crop.y, w: edits.crop.w, h: edits.crop.h },
      rotation: edits.crop.angle,
      rotationSteps: 0,
      flipH: false,
      flipV: false,
      aspectPreset: edits.crop.aspectPreset as never,
      lockAspect: edits.crop.lockAspect,
    });
  }
}

function resetEdits() {
  useAdjustmentsStore.getState().resetAll();
  useColorMixerStore.getState().reset();
  useColorGradingStore.getState().reset();
  useEffectsStore.getState().reset();
  useToneCurveStore.getState().reset();
}

export function usePhotoEdits(selectedId: string | null) {
  const prevIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const savePhotoEdits = useCatalogStore((s) => s.savePhotoEdits);
  const getPhotoEdits = useCatalogStore((s) => s.getPhotoEdits);
  const saveToDisk = useCatalogStore((s) => s.saveToDisk);

  // Load / save edits when selected photo changes
  useEffect(() => {
    const prevId = prevIdRef.current;

    if (prevId !== null) {
      savePhotoEdits(prevId, captureEdits(prevId));
    }

    if (selectedId !== null) {
      const stored = getPhotoEdits(selectedId);
      if (stored) {
        applyEdits(selectedId, stored);
      } else {
        resetEdits();
      }
    }

    prevIdRef.current = selectedId;
    saveToDisk();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Auto-save 1.5s after any edit store change
  useEffect(() => {
    if (!selectedId) return;
    let timer: ReturnType<typeof setTimeout>;

    const onAnyChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const id = selectedIdRef.current;
        if (!id) return;
        savePhotoEdits(id, captureEdits(id));
        saveToDisk();
      }, 1500);
    };

    const unsubs = [
      useAdjustmentsStore.subscribe(onAnyChange),
      useColorMixerStore.subscribe(onAnyChange),
      useColorGradingStore.subscribe(onAnyChange),
      useEffectsStore.subscribe(onAnyChange),
      useToneCurveStore.subscribe(onAnyChange),
      useCropStore.subscribe(onAnyChange),
    ];

    return () => {
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Main process asks renderer to save before quitting
  useEffect(() => {
    window.electron.onRequestSave(async () => {
      const id = selectedIdRef.current;
      if (id) {
        savePhotoEdits(id, captureEdits(id));
        await saveToDisk();
      }
      window.electron.sendSaveDone();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
