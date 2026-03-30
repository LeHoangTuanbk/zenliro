/** Shared pixel analysis helpers */

export function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function getLuminance(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

export const GRID_NAMES_3X3 = [
  'top-left',
  'top-center',
  'top-right',
  'mid-left',
  'center',
  'mid-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const GRID_NAMES_5X5 = [
  'r1c1',
  'r1c2',
  'r1c3',
  'r1c4',
  'r1c5',
  'r2c1',
  'r2c2',
  'r2c3',
  'r2c4',
  'r2c5',
  'r3c1',
  'r3c2',
  'r3c3',
  'r3c4',
  'r3c5',
  'r4c1',
  'r4c2',
  'r4c3',
  'r4c4',
  'r4c5',
  'r5c1',
  'r5c2',
  'r5c3',
  'r5c4',
  'r5c5',
];
