export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';
export type CurvePoint = { x: number; y: number };
export type ZoneSplits = [number, number, number];
export type ParametricSliders = {
  highlights: number;
  lights: number;
  darks: number;
  shadows: number;
};

export const DEFAULT_ZONE_SPLITS: ZoneSplits = [0.25, 0.5, 0.75];

export const defaultPoints = (): CurvePoint[] => [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export const defaultCurvePoints = (): Record<CurveChannel, CurvePoint[]> => ({
  rgb: defaultPoints(),
  r: defaultPoints(),
  g: defaultPoints(),
  b: defaultPoints(),
});

export const defaultParametric = (): ParametricSliders => ({
  highlights: 0,
  lights: 0,
  darks: 0,
  shadows: 0,
});
