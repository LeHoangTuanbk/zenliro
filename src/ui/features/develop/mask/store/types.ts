export const MaskType = {
  Brush: 'brush',
  Linear: 'linear',
  Radial: 'radial',
} as const;
export type MaskType = (typeof MaskType)[keyof typeof MaskType];

// ── Brush ────────────────────────────────────────────────────────────────────

export type BrushPoint = { x: number; y: number }; // normalized 0-1

export type BrushStroke = {
  points: BrushPoint[];
  size: number;    // normalized (fraction of image width)
  feather: number; // 0-1
  opacity: number; // 0-1
  erase: boolean;
};

// ── Linear gradient ──────────────────────────────────────────────────────────

export type LinearMaskData = {
  x1: number; y1: number; // start point, normalized 0-1
  x2: number; y2: number; // end point, normalized 0-1
  feather: number;        // 0-1, width of soft transition
};

// ── Radial gradient ──────────────────────────────────────────────────────────

export type RadialMaskData = {
  cx: number; cy: number;  // center, normalized 0-1
  rx: number; ry: number;  // radii, normalized to image width
  angle: number;           // degrees
  feather: number;         // 0-1
  invert: boolean;         // false = affect inside, true = affect outside
};

// ── Union ────────────────────────────────────────────────────────────────────

export type MaskData =
  | { type: 'brush'; strokes: BrushStroke[] }
  | { type: 'linear'; data: LinearMaskData }
  | { type: 'radial'; data: RadialMaskData };

// ── Adjustments ──────────────────────────────────────────────────────────────
// Delta values applied on top of the global adjustments within the mask region.

export type MaskAdjustments = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temp: number;
  tint: number;
  texture: number;
  clarity: number;
  dehaze: number;
  vibrance: number;
  saturation: number;
};

export const DEFAULT_MASK_ADJUSTMENTS: MaskAdjustments = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temp: 0, tint: 0, texture: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0,
};

// ── Mask ─────────────────────────────────────────────────────────────────────

export type Mask = {
  id: string;
  name: string;
  enabled: boolean;
  mask: MaskData;
  adjustments: MaskAdjustments;
};
