export type GradingRange = 'shadows' | 'midtones' | 'highlights';

export type WheelState = {
  hue: number;  // 0–360
  sat: number;  // 0–1
  lum: number;  // -100 to 100
};

export const defaultWheel = (): WheelState => ({ hue: 0, sat: 0, lum: 0 });
