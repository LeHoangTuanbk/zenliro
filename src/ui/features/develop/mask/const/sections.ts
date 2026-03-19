import type { MaskAdjustments } from '../store';

export type SliderDef = {
  key: keyof MaskAdjustments;
  label: string;
  min: number;
  max: number;
  step?: number;
};

export type Section = { title: string; sliders: SliderDef[] };

export const SECTIONS: Section[] = [
  {
    title: 'White Balance',
    sliders: [
      { key: 'temp', label: 'Temp', min: -100, max: 100 },
      { key: 'tint', label: 'Tint', min: -100, max: 100 },
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
