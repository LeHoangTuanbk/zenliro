import type { Adjustments } from '../store/adjustments-store';

type Section = {
  title: string;
  sliders: Array<{
    label: string;
    name: keyof Adjustments;
    min: number;
    max: number;
    step?: number;
    gradient?: string;
  }>;
};

const TEMP_GRADIENT = 'linear-gradient(to right, #2855cc, #5b8fd4, #c8c0a8, #d4a44e, #c48a1a)';
const TINT_GRADIENT = 'linear-gradient(to right, #4a9a3a, #7ab86a, #c8c0a8, #b878b0, #9a44b8)';

export const SECTIONS: Section[] = [
  {
    title: 'White Balance',
    sliders: [
      { label: 'Temp', name: 'temp', min: -100, max: 100, gradient: TEMP_GRADIENT },
      { label: 'Tint', name: 'tint', min: -100, max: 100, gradient: TINT_GRADIENT },
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
