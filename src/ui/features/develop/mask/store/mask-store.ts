import { create } from 'zustand';
import type { Mask, MaskAdjustments, BrushStroke, LinearMaskData, RadialMaskData } from './types';
import { DEFAULT_MASK_ADJUSTMENTS } from './types';

const DEFAULT_LINEAR: LinearMaskData = { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8, feather: 0.3 };
const DEFAULT_RADIAL: RadialMaskData = { cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.2, angle: 0, feather: 0.3, invert: false };

let _uid = 0;
const uid = () => `mask-${++_uid}-${Date.now()}`;

type MaskStore = {
  masksByPhoto: Record<string, Mask[]>;
  selectedMaskId: string | null;

  // Brush tool settings
  brushSizePx: number;    // 5-200
  brushFeather: number;   // 0-100
  brushOpacity: number;   // 0-100
  brushErase: boolean;

  // Selectors
  getMasks: (photoId: string) => Mask[];
  getSelected: (photoId: string) => Mask | null;

  // Mask lifecycle
  addMask: (photoId: string, type: Mask['mask']['type']) => string;
  removeMask: (photoId: string, maskId: string) => void;
  selectMask: (id: string | null) => void;
  toggleMask: (photoId: string, maskId: string) => void;

  // Brush
  addStroke: (photoId: string, maskId: string, stroke: BrushStroke) => void;
  setBrushSizePx: (px: number) => void;
  setBrushFeather: (v: number) => void;
  setBrushOpacity: (v: number) => void;
  setBrushErase: (v: boolean) => void;

  // Gradient
  setLinearData: (photoId: string, maskId: string, data: LinearMaskData) => void;
  setRadialData: (photoId: string, maskId: string, data: RadialMaskData) => void;

  // Adjustments
  setMaskAdjustment: (
    photoId: string,
    maskId: string,
    key: keyof MaskAdjustments,
    value: number,
  ) => void;
  resetMaskAdjustments: (photoId: string, maskId: string) => void;

  // Persistence
  setMasksForPhoto: (photoId: string, masks: Mask[]) => void;
};

export const useMaskStore = create<MaskStore>((set, get) => ({
  masksByPhoto: {},
  selectedMaskId: null,
  brushSizePx: 40,
  brushFeather: 50,
  brushOpacity: 100,
  brushErase: false,

  getMasks: (photoId) => get().masksByPhoto[photoId] ?? [],

  getSelected: (photoId) => {
    const { masksByPhoto, selectedMaskId } = get();
    if (!selectedMaskId) return null;
    return (masksByPhoto[photoId] ?? []).find((m) => m.id === selectedMaskId) ?? null;
  },

  addMask: (photoId, type) => {
    const id = uid();
    const count = (get().masksByPhoto[photoId] ?? []).length + 1;
    const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;

    let mask: Mask['mask'];
    if (type === 'brush') mask = { type: 'brush', strokes: [] };
    else if (type === 'linear') mask = { type: 'linear', data: DEFAULT_LINEAR };
    else mask = { type: 'radial', data: DEFAULT_RADIAL };

    const newMask: Mask = { id, name, enabled: true, mask, adjustments: { ...DEFAULT_MASK_ADJUSTMENTS } };
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: [...(s.masksByPhoto[photoId] ?? []), newMask],
      },
      selectedMaskId: id,
    }));
    return id;
  },

  removeMask: (photoId, maskId) =>
    set((s) => {
      const masks = (s.masksByPhoto[photoId] ?? []).filter((m) => m.id !== maskId);
      return {
        masksByPhoto: { ...s.masksByPhoto, [photoId]: masks },
        selectedMaskId: s.selectedMaskId === maskId ? (masks[masks.length - 1]?.id ?? null) : s.selectedMaskId,
      };
    }),

  selectMask: (id) => set({ selectedMaskId: id }),

  toggleMask: (photoId, maskId) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) =>
          m.id === maskId ? { ...m, enabled: !m.enabled } : m,
        ),
      },
    })),

  addStroke: (photoId, maskId, stroke) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) => {
          if (m.id !== maskId || m.mask.type !== 'brush') return m;
          return { ...m, mask: { type: 'brush', strokes: [...m.mask.strokes, stroke] } };
        }),
      },
    })),

  setBrushSizePx: (px) => set({ brushSizePx: px }),
  setBrushFeather: (v) => set({ brushFeather: v }),
  setBrushOpacity: (v) => set({ brushOpacity: v }),
  setBrushErase: (v) => set({ brushErase: v }),

  setLinearData: (photoId, maskId, data) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) =>
          m.id === maskId ? { ...m, mask: { type: 'linear', data } } : m,
        ),
      },
    })),

  setRadialData: (photoId, maskId, data) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) =>
          m.id === maskId ? { ...m, mask: { type: 'radial', data } } : m,
        ),
      },
    })),

  setMaskAdjustment: (photoId, maskId, key, value) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) =>
          m.id === maskId ? { ...m, adjustments: { ...m.adjustments, [key]: value } } : m,
        ),
      },
    })),

  resetMaskAdjustments: (photoId, maskId) =>
    set((s) => ({
      masksByPhoto: {
        ...s.masksByPhoto,
        [photoId]: (s.masksByPhoto[photoId] ?? []).map((m) =>
          m.id === maskId ? { ...m, adjustments: { ...DEFAULT_MASK_ADJUSTMENTS } } : m,
        ),
      },
    })),

  setMasksForPhoto: (photoId, masks) =>
    set((s) => ({ masksByPhoto: { ...s.masksByPhoto, [photoId]: masks } })),
}));
