export const clampStep = (raw: number, min: number, max: number, step: number): number => {
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))));
};
