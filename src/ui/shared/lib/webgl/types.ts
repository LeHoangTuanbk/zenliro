// 0=disabled, 1=brush, 2=linear, 3=radial
export type MaskGPUType = 0 | 1 | 2 | 3;

export type MaskGPUData = {
  type: MaskGPUType;
  // Linear: [x1, y1, x2, y2, feather]
  linear?: [number, number, number, number, number];
  // Radial: [cx, cy, rx, ry, angleDeg, feather, invert01]
  radial?: [number, number, number, number, number, number, number];
  // Delta adjustments
  adj: {
    exposure: number; contrast: number;
    highlights: number; shadows: number; whites: number; blacks: number;
    temp: number; tint: number;
    texture: number; clarity: number; dehaze: number;
    vibrance: number; saturation: number;
  };
};

export type SpotGPUData = {
  dst: { x: number; y: number };
  src: { x: number; y: number };
  radius: number;
  feather: number;
  opacity: number;
  mode: 0 | 1 | 2; // 0=heal, 1=clone, 2=fill
  colorData: [number, number, number];
};
