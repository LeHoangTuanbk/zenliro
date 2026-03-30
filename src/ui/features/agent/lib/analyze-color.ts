/** Color harmony analysis and skin tone check */

import { rgbToHsl } from './pixel-helpers';

// ─── Color Harmony ────────────────────────────────────────────────────

function hueDiff(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

export function analyzeColorHarmony(data: Uint8ClampedArray, w: number, h: number) {
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
    const hasComplement = hues.some(
      (h) => hueDiff(h, primaryHue) >= 150 && hueDiff(h, primaryHue) <= 210,
    );
    const hasTriad = hues.some(
      (h) => hueDiff(h, primaryHue) >= 100 && hueDiff(h, primaryHue) <= 140,
    );
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
