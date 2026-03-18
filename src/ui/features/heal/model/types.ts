export type HealMode = 'heal' | 'clone' | 'fill';
export type ActiveTool = 'edit' | 'heal' | 'crop';

export interface HealSpot {
  id: string;
  mode: HealMode;
  dst: { x: number; y: number }; // normalized 0–1 relative to image width/height
  src: { x: number; y: number }; // normalized 0–1
  radius: number; // normalized radius (relative to image width)
  feather: number; // 0–100
  opacity: number; // 0–100
}
