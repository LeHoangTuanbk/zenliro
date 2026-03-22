import { create } from 'zustand';
import { type CropState, type AspectRatioPreset, DEFAULT_CROP_STATE, ASPECT_RATIOS } from './types';

interface CropStoreState {
  cropByPhoto: Record<string, CropState>;
}

interface CropStoreActions {
  getCrop(photoId: string): CropState;
  setCrop(photoId: string, patch: Partial<CropState>): void;
  resetCrop(photoId: string): void;
  removePhoto(photoId: string): void;
  /** Apply a new aspect ratio preset, adjusting the rect to maintain center */
  setAspectPreset(photoId: string, preset: AspectRatioPreset, imageAspect: number): void;
}

export const useCropStore = create<CropStoreState & CropStoreActions>((set, get) => ({
  cropByPhoto: {},

  getCrop: (photoId) => get().cropByPhoto[photoId] ?? { ...DEFAULT_CROP_STATE },

  setCrop: (photoId, patch) =>
    set((s) => ({
      cropByPhoto: {
        ...s.cropByPhoto,
        [photoId]: { ...(s.cropByPhoto[photoId] ?? DEFAULT_CROP_STATE), ...patch },
      },
    })),

  resetCrop: (photoId) =>
    set((s) => ({
      cropByPhoto: { ...s.cropByPhoto, [photoId]: { ...DEFAULT_CROP_STATE } },
    })),

  removePhoto: (photoId) =>
    set((s) => {
      const { [photoId]: _, ...rest } = s.cropByPhoto;
      return { cropByPhoto: rest };
    }),

  setAspectPreset: (photoId, preset, imageAspect) => {
    const current = get().cropByPhoto[photoId] ?? { ...DEFAULT_CROP_STATE };
    const entry = ASPECT_RATIOS.find((r) => r.value === preset);
    const targetRatio =
      preset === 'original' ? imageAspect :
      preset === 'free'     ? null :
      (entry?.ratio ?? null);

    if (targetRatio === null) {
      // Free: just update preset
      set((s) => ({
        cropByPhoto: {
          ...s.cropByPhoto,
          [photoId]: { ...current, aspectPreset: preset, lockAspect: false },
        },
      }));
      return;
    }

    // Adjust rect to match new aspect ratio, centered on current rect center
    const { rect } = current;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    // The image-space aspect of the current rect:
    // rect.w represents a fraction of imgW, rect.h of imgH
    // so image-pixel ratio = (rect.w * imgW) / (rect.h * imgH) = (rect.w / rect.h) * imageAspect
    // We want (newW / newH) * imageAspect = targetRatio
    // => newW / newH = targetRatio / imageAspect

    const normRatio = targetRatio / imageAspect;

    let newW = rect.w;
    let newH = rect.h;

    if (newW / newH > normRatio) {
      newH = newW / normRatio;
    } else {
      newW = newH * normRatio;
    }

    // Clamp to [0,1]
    if (newW > 1) { newW = 1; newH = newW / normRatio; }
    if (newH > 1) { newH = 1; newW = newH * normRatio; }

    const newX = Math.max(0, Math.min(1 - newW, cx - newW / 2));
    const newY = Math.max(0, Math.min(1 - newH, cy - newH / 2));

    set((s) => ({
      cropByPhoto: {
        ...s.cropByPhoto,
        [photoId]: {
          ...current,
          aspectPreset: preset,
          lockAspect: true,
          rect: { x: newX, y: newY, w: newW, h: newH },
        },
      },
    }));
  },
}));
