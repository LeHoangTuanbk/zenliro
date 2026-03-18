export type AspectRatioPreset =
  | 'free'
  | 'original'
  | '1:1'
  | '4:3'
  | '3:2'
  | '16:9'
  | '5:4'
  | '7:5'
  | '2:3';

export interface CropRect {
  x: number; // normalized 0–1 (left edge relative to image width)
  y: number; // normalized 0–1 (top edge relative to image height)
  w: number; // normalized width
  h: number; // normalized height
}

export interface CropState {
  rect: CropRect;
  rotation: number;      // straighten angle, -45 to +45 degrees
  rotationSteps: number; // multiples of 90° (CW = +1, CCW = -1)
  flipH: boolean;
  flipV: boolean;
  aspectPreset: AspectRatioPreset;
  lockAspect: boolean;
}

export const DEFAULT_CROP_STATE: CropState = {
  rect: { x: 0, y: 0, w: 1, h: 1 },
  rotation: 0,
  rotationSteps: 0,
  flipH: false,
  flipV: false,
  aspectPreset: 'free',
  lockAspect: false,
};

export const ASPECT_RATIOS: { label: string; value: AspectRatioPreset; ratio?: number }[] = [
  { label: 'Free',      value: 'free'     },
  { label: 'Original',  value: 'original' },
  { label: '1 : 1',     value: '1:1',      ratio: 1 },
  { label: '4 : 3',     value: '4:3',      ratio: 4 / 3 },
  { label: '3 : 2',     value: '3:2',      ratio: 3 / 2 },
  { label: '16 : 9',    value: '16:9',     ratio: 16 / 9 },
  { label: '5 : 4',     value: '5:4',      ratio: 5 / 4 },
  { label: '7 : 5',     value: '7:5',      ratio: 7 / 5 },
  { label: '2 : 3',     value: '2:3',      ratio: 2 / 3 },
];
