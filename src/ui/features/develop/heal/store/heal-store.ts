import { create } from 'zustand';
import type { HealSpot, HealMode } from './types';

interface HealState {
  spotsByPhoto: Record<string, HealSpot[]>;
  activeMode: HealMode;
  brushSizePx: number;      // brush radius in screen pixels (5–200)
  feather: number;          // 0–100
  opacity: number;          // 0–100
  selectedSpotId: string | null;
  previewOriginal: boolean; // show before (no spots) when true
}

interface HealActions {
  getSpots(photoId: string): HealSpot[];
  addSpot(photoId: string, spot: HealSpot): void;
  updateSpot(photoId: string, id: string, patch: Partial<HealSpot>): void;
  removeSpot(photoId: string, id: string): void;
  clearAll(photoId: string): void;
  removePhoto(photoId: string): void;
  setActiveMode(mode: HealMode): void;
  setBrushSizePx(px: number): void;
  setFeather(f: number): void;
  setOpacity(o: number): void;
  setSelectedSpotId(id: string | null): void;
  setPreviewOriginal(v: boolean): void;
}

export const useHealStore = create<HealState & HealActions>((set, get) => ({
  spotsByPhoto: {},
  activeMode: 'heal',
  brushSizePx: 40,
  feather: 50,
  opacity: 100,
  selectedSpotId: null,
  previewOriginal: false,

  getSpots: (photoId) => get().spotsByPhoto[photoId] ?? [],

  addSpot: (photoId, spot) =>
    set((s) => ({
      spotsByPhoto: {
        ...s.spotsByPhoto,
        [photoId]: [...(s.spotsByPhoto[photoId] ?? []), spot],
      },
    })),

  updateSpot: (photoId, id, patch) =>
    set((s) => ({
      spotsByPhoto: {
        ...s.spotsByPhoto,
        [photoId]: (s.spotsByPhoto[photoId] ?? []).map((sp) =>
          sp.id === id ? { ...sp, ...patch } : sp,
        ),
      },
    })),

  removeSpot: (photoId, id) =>
    set((s) => ({
      spotsByPhoto: {
        ...s.spotsByPhoto,
        [photoId]: (s.spotsByPhoto[photoId] ?? []).filter((sp) => sp.id !== id),
      },
      selectedSpotId: s.selectedSpotId === id ? null : s.selectedSpotId,
    })),

  clearAll: (photoId) =>
    set((s) => ({
      spotsByPhoto: { ...s.spotsByPhoto, [photoId]: [] },
      selectedSpotId: null,
    })),

  removePhoto: (photoId) =>
    set((s) => {
      const { [photoId]: _, ...rest } = s.spotsByPhoto;
      return { spotsByPhoto: rest, selectedSpotId: null };
    }),

  setActiveMode: (activeMode) => set({ activeMode }),
  setBrushSizePx: (brushSizePx) => set({ brushSizePx }),
  setFeather: (feather) => set({ feather }),
  setOpacity: (opacity) => set({ opacity }),
  setSelectedSpotId: (selectedSpotId) => set({ selectedSpotId }),
  setPreviewOriginal: (previewOriginal) => set({ previewOriginal }),
}));
