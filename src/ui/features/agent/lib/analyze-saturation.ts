/** Saturation map and clipping map analysis */

import { rgbToHsl, getLuminance, GRID_NAMES_3X3, GRID_NAMES_5X5 } from './pixel-helpers';

// ─── Saturation Map ───────────────────────────────────────────────────

export function analyzeSaturationMap(data: Uint8ClampedArray, w: number, h: number, gridSize = 3) {
  const size = gridSize === 5 ? 5 : 3;
  const names = size === 5 ? GRID_NAMES_5X5 : GRID_NAMES_3X3;

  const regions: Array<{
    position: string;
    avgSaturation: number;
    maxSaturation: number;
    oversaturatedPct: number;
    colorClippingPct: number;
    flag: string;
  }> = [];

  let totalSat = 0,
    totalCount = 0;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x0 = Math.floor((col / size) * w);
      const x1 = Math.floor(((col + 1) / size) * w);
      const y0 = Math.floor((row / size) * h);
      const y1 = Math.floor(((row + 1) / size) * h);

      let satSum = 0,
        maxSat = 0,
        oversat = 0,
        colorClip = 0,
        count = 0;

      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          const idx = (y * w + x) * 4;
          const r = data[idx],
            g = data[idx + 1],
            b = data[idx + 2];
          const hsl = rgbToHsl(r, g, b);
          satSum += hsl.s;
          if (hsl.s > maxSat) maxSat = hsl.s;
          if (hsl.s > 90) oversat++;
          if (
            (r === 255 && (g < 250 || b < 250)) ||
            (g === 255 && (r < 250 || b < 250)) ||
            (b === 255 && (r < 250 || g < 250))
          ) {
            colorClip++;
          }
          count++;
        }
      }

      const avgSat = Math.round(satSum / count);
      totalSat += satSum;
      totalCount += count;

      let flag = 'ok';
      if ((oversat / count) * 100 > 10) flag = 'oversaturated';
      else if ((colorClip / count) * 100 > 5) flag = 'color-clipping';

      regions.push({
        position: names[row * size + col],
        avgSaturation: avgSat,
        maxSaturation: maxSat,
        oversaturatedPct: Math.round((oversat / count) * 100),
        colorClippingPct: Math.round((colorClip / count) * 100),
        flag,
      });
    }
  }

  const overallAvg = Math.round(totalSat / totalCount);
  const flaggedRegions = regions.filter((r) => r.flag !== 'ok');

  let assessment: string;
  if (overallAvg < 15) assessment = 'very desaturated';
  else if (overallAvg < 30) assessment = 'low saturation';
  else if (overallAvg < 50) assessment = 'moderate saturation';
  else if (overallAvg < 70) assessment = 'high saturation';
  else assessment = 'very high saturation';

  const suggestions: string[] = [];
  if (flaggedRegions.length > 0) {
    const flaggedNames = flaggedRegions.map((r) => r.position).join(', ');
    suggestions.push(
      `Oversaturation in: ${flaggedNames}. Use vibrance instead of saturation to protect already-saturated areas.`,
    );
  }
  if (overallAvg > 60)
    suggestions.push(
      'High overall saturation. Consider reducing saturation by -5 to -10 and using vibrance instead.',
    );
  if (overallAvg < 20)
    suggestions.push('Low saturation. Consider +10 to +20 vibrance for natural color boost.');
  if (suggestions.length === 0) suggestions.push('Saturation levels look balanced.');

  return {
    gridSize: size,
    overall: { avgSaturation: overallAvg, assessment },
    regions,
    suggestions,
  };
}

// ─── Clipping Map ─────────────────────────────────────────────────────

export function detectClippingMap(data: Uint8ClampedArray, w: number, h: number) {
  const SIZE = 5;

  const regions: Array<{
    position: string;
    shadowClipPct: number;
    highlightClipPct: number;
    redClipPct: number;
    greenClipPct: number;
    blueClipPct: number;
    severity: string;
  }> = [];

  let totalShadow = 0,
    totalHighlight = 0,
    totalPixels = 0;

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const x0 = Math.floor((col / SIZE) * w);
      const x1 = Math.floor(((col + 1) / SIZE) * w);
      const y0 = Math.floor((row / SIZE) * h);
      const y1 = Math.floor(((row + 1) / SIZE) * h);

      let shadows = 0,
        highlights = 0,
        redClip = 0,
        greenClip = 0,
        blueClip = 0,
        count = 0;

      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          const idx = (y * w + x) * 4;
          const r = data[idx],
            g = data[idx + 1],
            b = data[idx + 2];
          const lum = getLuminance(r, g, b);

          if (lum < 3) shadows++;
          if (lum > 252) highlights++;
          if (r <= 1) redClip++;
          if (r >= 254) redClip++;
          if (g <= 1) greenClip++;
          if (g >= 254) greenClip++;
          if (b <= 1) blueClip++;
          if (b >= 254) blueClip++;
          count++;
        }
      }

      totalShadow += shadows;
      totalHighlight += highlights;
      totalPixels += count;

      const pct = (v: number) => Math.round((v / count) * 100);
      const totalClip = pct(shadows) + pct(highlights);

      let severity: string;
      if (totalClip < 1) severity = 'none';
      else if (totalClip < 5) severity = 'mild';
      else if (totalClip < 15) severity = 'moderate';
      else severity = 'severe';

      regions.push({
        position: GRID_NAMES_5X5[row * SIZE + col],
        shadowClipPct: pct(shadows),
        highlightClipPct: pct(highlights),
        redClipPct: pct(redClip),
        greenClipPct: pct(greenClip),
        blueClipPct: pct(blueClip),
        severity,
      });
    }
  }

  const pct = (v: number) => Math.round((v / totalPixels) * 100);
  const worstShadow = [...regions]
    .sort((a, b) => b.shadowClipPct - a.shadowClipPct)
    .filter((r) => r.shadowClipPct > 1);
  const worstHighlight = [...regions]
    .sort((a, b) => b.highlightClipPct - a.highlightClipPct)
    .filter((r) => r.highlightClipPct > 1);

  const suggestions: string[] = [];
  if (worstHighlight.length > 0) {
    const worstNames = worstHighlight
      .slice(0, 3)
      .map((r) => r.position)
      .join(', ');
    suggestions.push(
      `Highlight clipping in: ${worstNames}. Pull highlights -30 to -60, or use a graduated/radial mask.`,
    );
  }
  if (worstShadow.length > 0) {
    const worstNames = worstShadow
      .slice(0, 3)
      .map((r) => r.position)
      .join(', ');
    suggestions.push(
      `Shadow clipping in: ${worstNames}. Raise shadows +20 to +40, or raise blacks.`,
    );
  }
  if (suggestions.length === 0) suggestions.push('No significant clipping detected.');

  return {
    overall: {
      shadowClipPct: pct(totalShadow),
      highlightClipPct: pct(totalHighlight),
      totalClipPct: pct(totalShadow + totalHighlight),
    },
    regions,
    worstShadowRegions: worstShadow.slice(0, 3).map((r) => r.position),
    worstHighlightRegions: worstHighlight.slice(0, 3).map((r) => r.position),
    suggestions,
  };
}
