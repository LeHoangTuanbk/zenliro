/** Local contrast (micro-contrast) analysis */

import { getLuminance, GRID_NAMES_3X3 } from './pixel-helpers';

const PATCH_SIZE = 16;

export function analyzeLocalContrast(data: Uint8ClampedArray, w: number, h: number) {
  const ROWS = 3,
    COLS = 3;
  const regions: Array<{
    position: string;
    localContrast: number;
    rmsContrast: number;
    assessment: string;
  }> = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.floor((col / COLS) * w);
      const x1 = Math.floor(((col + 1) / COLS) * w);
      const y0 = Math.floor((row / ROWS) * h);
      const y1 = Math.floor(((row + 1) / ROWS) * h);

      let michelsonSum = 0,
        rmsSum = 0,
        patchCount = 0;
      const stepX = Math.max(PATCH_SIZE, Math.floor((x1 - x0) / 8));
      const stepY = Math.max(PATCH_SIZE, Math.floor((y1 - y0) / 8));

      for (let py = y0; py + PATCH_SIZE < y1; py += stepY) {
        for (let px = x0; px + PATCH_SIZE < x1; px += stepX) {
          let lMin = 255,
            lMax = 0,
            lumSum = 0,
            lumSqSum = 0,
            n = 0;

          for (let dy = 0; dy < PATCH_SIZE; dy++) {
            for (let dx = 0; dx < PATCH_SIZE; dx++) {
              const idx = ((py + dy) * w + (px + dx)) * 4;
              const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
              if (lum < lMin) lMin = lum;
              if (lum > lMax) lMax = lum;
              lumSum += lum;
              lumSqSum += lum * lum;
              n++;
            }
          }

          michelsonSum += (lMax - lMin) / (lMax + lMin + 1);
          const mean = lumSum / n;
          rmsSum += Math.sqrt(Math.max(0, lumSqSum / n - mean * mean));
          patchCount++;
        }
      }

      const localContrast =
        patchCount > 0 ? Math.round((michelsonSum / patchCount) * 100) / 100 : 0;
      const rmsContrast = patchCount > 0 ? Math.round((rmsSum / patchCount) * 10) / 10 : 0;

      let assessment: string;
      if (localContrast < 0.15) assessment = 'flat/hazy';
      else if (localContrast < 0.3) assessment = 'low contrast';
      else if (localContrast < 0.5) assessment = 'moderate';
      else if (localContrast < 0.7) assessment = 'good';
      else assessment = 'high contrast';

      regions.push({
        position: GRID_NAMES_3X3[row * COLS + col],
        localContrast,
        rmsContrast,
        assessment,
      });
    }
  }

  const avgLocal =
    Math.round((regions.reduce((s, r) => s + r.localContrast, 0) / regions.length) * 100) / 100;
  const avgRms =
    Math.round((regions.reduce((s, r) => s + r.rmsContrast, 0) / regions.length) * 10) / 10;

  let overallAssessment: string;
  if (avgLocal < 0.15) overallAssessment = 'flat/hazy';
  else if (avgLocal < 0.3) overallAssessment = 'low contrast';
  else if (avgLocal < 0.5) overallAssessment = 'moderate';
  else if (avgLocal < 0.7) overallAssessment = 'good';
  else overallAssessment = 'high contrast';

  const suggestions: string[] = [];
  if (avgLocal < 0.2)
    suggestions.push(
      `Low local contrast (${avgLocal}). Clarity +15 to +25 would improve midtone punch. Dehaze +5 to +15 if hazy.`,
    );
  else if (avgLocal < 0.35)
    suggestions.push(
      `Moderate local contrast (${avgLocal}). A slight clarity boost +5 to +10 could help.`,
    );
  else if (avgLocal > 0.65)
    suggestions.push(
      `High local contrast (${avgLocal}). Avoid adding clarity/texture to prevent harsh look.`,
    );
  else suggestions.push('Local contrast looks good. No adjustment needed.');

  return {
    overall: { localContrast: avgLocal, rmsContrast: avgRms, assessment: overallAssessment },
    regions,
    suggestions,
  };
}
