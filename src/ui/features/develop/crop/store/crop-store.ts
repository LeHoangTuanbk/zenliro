import { create } from 'zustand';
import { type CropState, type AspectRatioPreset, DEFAULT_CROP_STATE, ASPECT_RATIOS } from './types';
import { constrainCrop, fitCropToImage } from '../lib/constrain-crop';

interface CropStoreState {
  cropByPhoto: Record<string, CropState>;
}

interface CropStoreActions {
  getCrop(photoId: string): CropState;
  /** Pass `imageAspect` to apply "Constrain to Image"; omit to store the patch as-is (e.g. undo). */
  setCrop(photoId: string, patch: Partial<CropState>, imageAspect?: number): void;
  resetCrop(photoId: string): void;
  removePhoto(photoId: string): void;
  /** Apply a new aspect ratio preset, adjusting the rect to maintain center */
  setAspectPreset(photoId: string, preset: AspectRatioPreset, imageAspect: number): void;
}

export const useCropStore = create<CropStoreState & CropStoreActions>((set, get) => ({
  cropByPhoto: {},

  getCrop: (photoId) => get().cropByPhoto[photoId] ?? { ...DEFAULT_CROP_STATE },

  setCrop: (photoId, patch, imageAspect) =>
    set((s) => {
      const prev = { ...DEFAULT_CROP_STATE, ...s.cropByPhoto[photoId] };
      const next = { ...prev, ...patch };
      return {
        cropByPhoto: {
          ...s.cropByPhoto,
          [photoId]: imageAspect === undefined ? next : constrainCrop(prev, next, imageAspect),
        },
      };
    }),

  resetCrop: (photoId) =>
    set((s) => ({
      cropByPhoto: { ...s.cropByPhoto, [photoId]: { ...DEFAULT_CROP_STATE } },
    })),

  removePhoto: (photoId) =>
    set((s) => {
      const { [photoId]: _, ...rest } = s.cropByPhoto;
      return { cropByPhoto: rest };
    }),

  setAspectPreset: (photoId, preset, originalAspect) => {
    const current = { ...DEFAULT_CROP_STATE, ...get().cropByPhoto[photoId] };
    // The rect lives in rotated-image space, so odd 90° steps swap the aspect.
    const imageAspect =
      Math.abs(current.rotationSteps % 2) === 1 ? 1 / originalAspect : originalAspect;
    const entry = ASPECT_RATIOS.find((r) => r.value === preset);
    const targetRatio =
      preset === 'original' ? imageAspect : preset === 'free' ? null : (entry?.ratio ?? null);

    if (targetRatio === null) {
      get().setCrop(photoId, { aspectPreset: preset, lockAspect: false });
      return;
    }

    // rect.w is a fraction of the rotated width, rect.h of its height, so
    // (newW / newH) * imageAspect = targetRatio  =>  newW / newH = targetRatio / imageAspect
    const { rect } = current;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const normRatio = targetRatio / imageAspect;

    let newW = rect.w;
    let newH = rect.h;
    if (newW / newH > normRatio) newH = newW / normRatio;
    else newW = newH * normRatio;

    if (newW > 1) {
      newW = 1;
      newH = newW / normRatio;
    }
    if (newH > 1) {
      newH = 1;
      newW = newH * normRatio;
    }

    const newX = Math.max(0, Math.min(1 - newW, cx - newW / 2));
    const newY = Math.max(0, Math.min(1 - newH, cy - newH / 2));

    const next = {
      ...current,
      aspectPreset: preset,
      lockAspect: true,
      rect: { x: newX, y: newY, w: newW, h: newH },
    };
    set((s) => ({
      cropByPhoto: { ...s.cropByPhoto, [photoId]: fitCropToImage(next, originalAspect) },
    }));
  },
}));
