import type { MaskAdjustments } from '../store';

export type SliderDef = {
  key: keyof MaskAdjustments;
  label: string;
  min: number;
  max: number;
  step?: number;
  gradient?: string;
};

export type Section = { title: string; sliders: SliderDef[] };

const TEMP_GRADIENT = 'linear-gradient(to right, #2855cc, #5b8fd4, #c8c0a8, #d4a44e, #c48a1a)';
const TINT_GRADIENT = 'linear-gradient(to right, #4a9a3a, #7ab86a, #c8c0a8, #b878b0, #9a44b8)';

export const SECTIONS: Section[] = [
  {
    title: 'White Balance',
    sliders: [
      { key: 'temp', label: 'Temp', min: -100, max: 100, gradient: TEMP_GRADIENT },
      { key: 'tint', label: 'Tint', min: -100, max: 100, gradient: TINT_GRADIENT },
    ],
  },
  {
    title: 'Light',
    sliders: [
      { key: 'exposure', label: 'Exposure', min: -5, max: 5, step: 0.05 },
      { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
      { key: 'whites', label: 'Whites', min: -100, max: 100 },
      { key: 'blacks', label: 'Blacks', min: -100, max: 100 },
    ],
  },
  {
    title: 'Presence',
    sliders: [
      { key: 'texture', label: 'Texture', min: -100, max: 100 },
      { key: 'clarity', label: 'Clarity', min: -100, max: 100 },
      { key: 'dehaze', label: 'Dehaze', min: -100, max: 100 },
      { key: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
    ],
  },
];
