/** Pure analysis functions for AI photo evaluation tools */

// ─── Helpers ──────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number) {
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

function getLuminance(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

const GRID_NAMES_3X3 = [
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

const GRID_NAMES_5X5 = [
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

// ─── Zone System (Ansel Adams) ────────────────────────────────────────

const ZONE_NAMES = [
  'Zone 0 – Pure black',
  'Zone I – Near black',
  'Zone II – Deep shadows',
  'Zone III – Dark shadows with detail',
  'Zone IV – Dark midtones',
  'Zone V – Middle gray (18%)',
  'Zone VI – Light midtones (skin)',
  'Zone VII – Light tones',
  'Zone VIII – Near white with texture',
  'Zone IX – Near white',
  'Zone X – Pure white',
];

const ZONE_BOUNDARIES = [3, 26, 52, 77, 103, 128, 154, 179, 205, 230, 256];

export function analyzeExposure(data: Uint8ClampedArray, w: number, h: number) {
  const zones = new Array(11).fill(0);
  let lumSum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor((w * h) / 30000));

  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    lumSum += lum;
    count++;

    for (let z = 0; z < 11; z++) {
      if (lum < ZONE_BOUNDARIES[z]) {
        zones[z]++;
        break;
      }
    }
  }

  const meanLuminance = Math.round(lumSum / count);
  const zoneDistribution = zones.map((c, i) => ({
    zone: i,
    name: ZONE_NAMES[i],
    percentage: Math.round((c / count) * 100),
  }));

  const highZones = zones[7] + zones[8] + zones[9] + zones[10];
  const lowZones = zones[0] + zones[1] + zones[2] + zones[3];
  const highPct = (highZones / count) * 100;
  const lowPct = (lowZones / count) * 100;

  let exposureKey: string;
  if (highPct > 40) exposureKey = 'high-key';
  else if (lowPct > 40) exposureKey = 'low-key';
  else exposureKey = 'normal';

  const zonesUsed = zones.filter((c) => (c / count) * 100 > 2).length;
  const utilization =
    zonesUsed >= 9 ? 'excellent' : zonesUsed >= 7 ? 'good' : zonesUsed >= 5 ? 'moderate' : 'narrow';

  const suggestions: string[] = [];
  if (zoneDistribution[0].percentage + zoneDistribution[1].percentage > 10)
    suggestions.push('Shadow detail lost in zones 0-I. Consider raising shadows/blacks.');
  if (zoneDistribution[9].percentage + zoneDistribution[10].percentage > 10)
    suggestions.push('Highlight clipping in zones IX-X. Consider pulling highlights/whites.');
  if (zonesUsed < 5)
    suggestions.push('Narrow dynamic range. Consider increasing contrast or adjusting exposure.');
  if (meanLuminance < 80) suggestions.push('Image is dark overall. Consider increasing exposure.');
  if (meanLuminance > 180)
    suggestions.push('Image is bright overall. Consider decreasing exposure.');
  if (suggestions.length === 0) suggestions.push('Exposure looks well-balanced.');

  return {
    exposureKey,
    dynamicRange: { zonesUsed, utilization },
    zoneDistribution,
    meanLuminance,
    suggestions,
  };
}

// ─── Color Harmony ────────────────────────────────────────────────────

function hueDiff(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

export function analyzeColorHarmony(data: Uint8ClampedArray, w: number, h: number) {
  // Extract dominant colors (reuse quantization logic)
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  const step = Math.max(1, Math.floor((w * h) / 20000));
  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const qr = (data[idx] >> 4) << 4;
    const qg = (data[idx + 1] >> 4) << 4;
    const qb = (data[idx + 2] >> 4) << 4;
    const key = (qr << 16) | (qg << 8) | qb;
    const b = buckets.get(key);
    if (b) {
      b.r += data[idx];
      b.g += data[idx + 1];
      b.b += data[idx + 2];
      b.count++;
    } else buckets.set(key, { r: data[idx], g: data[idx + 1], b: data[idx + 2], count: 1 });
  }

  const totalSampled = Math.floor((w * h) / step);
  const topColors = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((b) => {
      const r = Math.round(b.r / b.count);
      const g = Math.round(b.g / b.count);
      const bl = Math.round(b.b / b.count);
      return {
        r,
        g,
        b: bl,
        ...rgbToHsl(r, g, bl),
        percentage: Math.round((b.count / totalSampled) * 100),
      };
    });

  // Separate chromatic vs neutral
  const chromatic = topColors.filter((c) => c.s >= 10);
  const neutralPct = topColors.filter((c) => c.s < 10).reduce((s, c) => s + c.percentage, 0);

  if (chromatic.length === 0) {
    return {
      paletteType: 'achromatic',
      harmonyScore: 80,
      dominantHues: topColors.map(({ h, s, l, percentage }) => ({ h, s, l, percentage })),
      neutralPercentage: neutralPct,
      suggestion:
        'Image is essentially monochrome/achromatic. Color grading can add mood through shadows/highlights split toning.',
    };
  }

  const hues = chromatic.map((c) => c.h);
  const primaryHue = hues[0];

  // Check harmony patterns
  const maxSpread = Math.max(...hues.map((h) => hueDiff(h, primaryHue)));

  let paletteType: string;
  let harmonyScore: number;

  if (maxSpread <= 15) {
    paletteType = 'monochromatic';
    harmonyScore = 90;
  } else if (maxSpread <= 60) {
    paletteType = 'analogous';
    harmonyScore = 85;
  } else {
    // Check for complementary (180° apart)
    const hasComplement = hues.some(
      (h) => hueDiff(h, primaryHue) >= 150 && hueDiff(h, primaryHue) <= 210,
    );
    // Check for triadic (120° apart)
    const hasTriad = hues.some(
      (h) => hueDiff(h, primaryHue) >= 100 && hueDiff(h, primaryHue) <= 140,
    );
    // Check for split-complementary
    const hasSplit = hues.some(
      (h) => hueDiff(h, primaryHue) >= 130 && hueDiff(h, primaryHue) <= 170,
    );

    if (hasComplement) {
      paletteType = 'complementary';
      harmonyScore = 80;
    } else if (hasTriad) {
      paletteType = 'triadic';
      harmonyScore = 75;
    } else if (hasSplit) {
      paletteType = 'split-complementary';
      harmonyScore = 78;
    } else {
      paletteType = 'mixed';
      harmonyScore = 60;
    }
  }

  const suggestions: string[] = [];
  if (paletteType === 'analogous')
    suggestions.push(
      `Analogous palette around ${primaryHue}°. Enhance by pushing shadows to the complementary hue (~${(primaryHue + 180) % 360}°) for depth.`,
    );
  if (paletteType === 'complementary')
    suggestions.push(
      'Complementary palette detected. Strengthen contrast between the two hue groups through color grading.',
    );
  if (paletteType === 'mixed')
    suggestions.push(
      'Colors are scattered. Consider desaturating competing hues via color mixer to create a cleaner palette.',
    );
  if (paletteType === 'monochromatic')
    suggestions.push(
      'Monochromatic palette. Add subtle complementary toning in shadows/highlights for dimension.',
    );

  return {
    paletteType,
    harmonyScore,
    dominantHues: chromatic.map(({ h, s, l, percentage }) => ({ h, s, l, percentage })),
    neutralPercentage: neutralPct,
    suggestion: suggestions.join(' '),
  };
}

// ─── Skin Tone Check ──────────────────────────────────────────────────

export function checkSkinTones(data: Uint8ClampedArray, w: number, h: number) {
  const step = Math.max(1, Math.floor((w * h) / 30000));
  let skinR = 0,
    skinG = 0,
    skinB = 0,
    skinCount = 0;
  let totalSampled = 0;

  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const r = data[idx],
      g = data[idx + 1],
      b = data[idx + 2];
    totalSampled++;

    // Skin detection: RGB + HSL combined check
    if (r < 80 || g < 50 || b < 30) continue;
    if (r <= g || g <= b) continue;
    if (r - g < 10 || r - b < 20) continue;

    const hsl = rgbToHsl(r, g, b);
    if (hsl.h < 5 || hsl.h > 50) continue;
    if (hsl.s < 15 || hsl.s > 75) continue;
    if (hsl.l < 20 || hsl.l > 80) continue;

    skinR += r;
    skinG += g;
    skinB += b;
    skinCount++;
  }

  const skinPct = Math.round((skinCount / totalSampled) * 100);

  if (skinPct < 1) {
    return {
      detected: false,
      skinPixelPercentage: skinPct,
      note: 'No significant skin tones detected. This may not be a portrait or skin is not prominent.',
    };
  }

  const avgR = Math.round(skinR / skinCount);
  const avgG = Math.round(skinG / skinCount);
  const avgB = Math.round(skinB / skinCount);
  const rgRatio = Math.round((avgR / avgG) * 100) / 100;
  const rbRatio = Math.round((avgR / avgB) * 100) / 100;

  const issues: string[] = [];
  const suggestions: string[] = [];

  // Ideal skin: R/G ~ 1.15-1.4, R/B ~ 1.4-2.0
  if (rgRatio > 1.45) {
    issues.push('Skin tones are too warm/red');
    suggestions.push('Reduce temp by -3 to -8 or reduce orange saturation in color mixer.');
  } else if (rgRatio < 1.1) {
    issues.push('Skin tones are too cool/desaturated');
    suggestions.push('Increase temp by +3 to +8 or boost orange/yellow saturation.');
  }

  if (rbRatio > 2.2) {
    issues.push('Skin has yellow/orange cast');
    suggestions.push('Add slight magenta tint (+2 to +5) or reduce yellow saturation.');
  } else if (rbRatio < 1.3) {
    issues.push('Skin has blue/magenta cast');
    suggestions.push('Reduce tint toward green (-2 to -5) or warm up temperature.');
  }

  // Green check: G too high relative to skin line
  const gBias = avgG - (avgR + avgB) / 2;
  if (gBias > 10) {
    issues.push('Skin has green tint');
    suggestions.push('Add magenta tint (+3 to +7).');
  } else if (gBias < -15) {
    issues.push('Skin has magenta tint');
    suggestions.push('Reduce tint toward green (-3 to -5).');
  }

  let healthScore: number;
  if (issues.length === 0) healthScore = 95;
  else if (issues.length === 1) healthScore = 75;
  else if (issues.length === 2) healthScore = 55;
  else healthScore = 35;

  const assessment =
    issues.length === 0
      ? 'Skin tones are healthy and natural.'
      : `Skin tone issues detected: ${issues.join('; ')}.`;

  return {
    detected: true,
    skinPixelPercentage: skinPct,
    avgSkinColor: { r: avgR, g: avgG, b: avgB },
    ratios: { rg: rgRatio, rb: rbRatio },
    healthScore,
    assessment,
    issues,
    suggestions:
      suggestions.length > 0 ? suggestions : ['Skin tones look good. No correction needed.'],
  };
}

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
          // Color channel clipping: one channel at 255 while others aren't
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
    const names = flaggedRegions.map((r) => r.position).join(', ');
    suggestions.push(
      `Oversaturation in: ${names}. Use vibrance instead of saturation to protect already-saturated areas.`,
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
  const names = GRID_NAMES_5X5;

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
        position: names[row * SIZE + col],
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
    const names = worstHighlight
      .slice(0, 3)
      .map((r) => r.position)
      .join(', ');
    suggestions.push(
      `Highlight clipping in: ${names}. Pull highlights -30 to -60, or use a graduated/radial mask.`,
    );
  }
  if (worstShadow.length > 0) {
    const names = worstShadow
      .slice(0, 3)
      .map((r) => r.position)
      .join(', ');
    suggestions.push(`Shadow clipping in: ${names}. Raise shadows +20 to +40, or raise blacks.`);
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

// ─── Local Contrast ───────────────────────────────────────────────────

export function analyzeLocalContrast(data: Uint8ClampedArray, w: number, h: number) {
  const ROWS = 3,
    COLS = 3;
  const PATCH_SIZE = 16;
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

          // Michelson contrast: (Lmax - Lmin) / (Lmax + Lmin + 1)
          michelsonSum += (lMax - lMin) / (lMax + lMin + 1);
          // RMS contrast: stddev of luminance
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
