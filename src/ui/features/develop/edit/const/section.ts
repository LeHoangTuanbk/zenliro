import type { Adjustments } from '../store/adjustments-store';

type Section = {
  title: string;
  sliders: Array<{
    label: string;
    name: keyof Adjustments;
    min: number;
    max: number;
    step?: number;
  }>;
};
export const SECTIONS: Section[] = [
  {
    title: 'White Balance',
    sliders: [
      { label: 'Temp', name: 'temp', min: -100, max: 100 },
      { label: 'Tint', name: 'tint', min: -100, max: 100 },
    ],
  },
  {
    title: 'Light',
    sliders: [
      { label: 'Exposure', name: 'exposure', min: -5, max: 5, step: 0.05 },
      { label: 'Contrast', name: 'contrast', min: -100, max: 100 },
      { label: 'Highlights', name: 'highlights', min: -100, max: 100 },
      { label: 'Shadows', name: 'shadows', min: -100, max: 100 },
      { label: 'Whites', name: 'whites', min: -100, max: 100 },
      { label: 'Blacks', name: 'blacks', min: -100, max: 100 },
    ],
  },
  {
    title: 'Presence',
    sliders: [
      { label: 'Texture', name: 'texture', min: -100, max: 100 },
      { label: 'Clarity', name: 'clarity', min: -100, max: 100 },
      { label: 'Dehaze', name: 'dehaze', min: -100, max: 100 },
      { label: 'Vibrance', name: 'vibrance', min: -100, max: 100 },
      { label: 'Saturation', name: 'saturation', min: -100, max: 100 },
    ],
  },
];
