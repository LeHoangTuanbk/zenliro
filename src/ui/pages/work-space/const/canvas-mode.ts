export const CanvasMode = {
  Loupe: 'loupe',
  Compare: 'compare',
} as const;

export type CanvasMode = (typeof CanvasMode)[keyof typeof CanvasMode];
