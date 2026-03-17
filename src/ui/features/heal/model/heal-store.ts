import { create } from 'zustand';
import type { HealSpot, HealMode } from './types';

interface HealState {
  spotsByPhoto: Record<string, HealSpot[]>;
  activeMode: HealMode;
  brushRadius: number;  // normalized 0.01–0.25 (relative to image width)
  feather: number;      // 0–100
  opacity: number;      // 0–100
  selectedSpotId: string | null;
}

interface HealActions {
  getSpots(photoId: string): HealSpot[];
  addSpot(photoId: string, spot: HealSpot): void;
  updateSpot(photoId: string, id: string, patch: Partial<HealSpot>): void;
  removeSpot(photoId: string, id: string): void;
  clearAll(photoId: string): void;
  setActiveMode(mode: HealMode): void;
  setBrushRadius(r: number): void;
  setFeather(f: number): void;
  setOpacity(o: number): void;
  setSelectedSpotId(id: string | null): void;
}

export const useHealStore = create<HealState & HealActions>((set, get) => ({
  spotsByPhoto: {},
  activeMode: 'heal',
  brushRadius: 0.05,
  feather: 50,
  opacity: 100,
  selectedSpotId: null,

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

  setActiveMode: (activeMode) => set({ activeMode }),
  setBrushRadius: (brushRadius) => set({ brushRadius }),
  setFeather: (feather) => set({ feather }),
  setOpacity: (opacity) => set({ opacity }),
  setSelectedSpotId: (selectedSpotId) => set({ selectedSpotId }),
}));
