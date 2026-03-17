export interface HealSpot {
  id: string;
  mode: 'heal' | 'clone';
  dst: { x: number; y: number }; // normalized 0–1 relative to image width/height
  src: { x: number; y: number }; // normalized 0–1
  radius: number;                 // normalized radius (relative to image width)
  feather: number;                // 0–100
  opacity: number;                // 0–100
}

export type HealMode = 'heal' | 'clone';
export type ActiveTool = 'develop' | 'heal';
