export type SpotGPUData = {
  dst: { x: number; y: number };
  src: { x: number; y: number };
  radius: number;
  feather: number;
  opacity: number;
  mode: 0 | 1 | 2; // 0=heal, 1=clone, 2=fill
  colorData: [number, number, number];
};
