import type { HealSpot } from '../store/types';

/**
 * Canvas 2D pixel-level heal/clone engine.
 *
 * Heal mode:  copies source texture while color-correcting it to match the
 *             luminosity/chrominance of the destination border — a simplified
 *             Poisson-blend approximation.
 * Clone mode: straight pixel copy with smooth feathering.
 *
 * NOTE: applySpots / applyOneSpot have been removed. GPU handles rendering
 * now via WebGLRenderer heal pass. Only precomputeColorData and autoFindSource
 * are used at runtime.
 */
export class HealEngine {
  /**
   * Sample mean color of the annulus between innerR and outerR.
   * Used by fill mode to read the skin/background color around a blemish.
   */
  static sampleAnnulusMean(
    data: Uint8ClampedArray,
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    w: number,
    h: number,
  ): { r: number; g: number; b: number } {
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;

    const x0 = Math.max(0, Math.floor(cx - outerR));
    const x1 = Math.min(w - 1, Math.ceil(cx + outerR));
    const y0 = Math.max(0, Math.floor(cy - outerR));
    const y1 = Math.min(h - 1, Math.ceil(cy + outerR));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist < innerR || dist > outerR) continue;
        const idx = (py * w + px) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }

    if (count === 0) return { r: 128, g: 128, b: 128 };
    return { r: rSum / count, g: gSum / count, b: bSum / count };
  }

  /**
   * Sample the mean color of the border annulus (75%–100% of radius).
   */
  static sampleBorderMean(
    data: Uint8ClampedArray,
    cx: number,
    cy: number,
    radius: number,
    w: number,
    h: number,
  ): { r: number; g: number; b: number } {
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
    const innerR = radius * 0.75;

    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(h - 1, Math.ceil(cy + radius));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist < innerR || dist > radius) continue;
        const idx = (py * w + px) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }

    if (count === 0) return { r: 128, g: 128, b: 128 };
    return { r: rSum / count, g: gSum / count, b: bSum / count };
  }

  /**
   * CPU pre-computation (O(perimeter)) for a single spot.
   * Returns the colorData in 0-1 range to be uploaded as a GPU uniform.
   * - fill: mean color of surrounding annulus (100-140% radius)
   * - heal: color offset (dst border mean minus src border mean)
   * - clone: [0,0,0] — GPU samples source directly
   */
  static precomputeColorData(
    data: Uint8ClampedArray,
    spot: HealSpot,
    imgW: number,
    imgH: number,
  ): [number, number, number] {
    const cx = Math.round(spot.dst.x * imgW);
    const cy = Math.round(spot.dst.y * imgH);
    const radius = Math.max(1, Math.round(spot.radius * imgW));

    if (spot.mode === 'fill') {
      // Sample only the immediate border (100–115% radius) for a tight local color match.
      const outerR = Math.round(radius * 1.15);
      const m = this.sampleAnnulusMean(data, cx, cy, radius, outerR, imgW, imgH);
      return [m.r / 255, m.g / 255, m.b / 255];
    }

    if (spot.mode === 'heal') {
      const scx = Math.round(spot.src.x * imgW);
      const scy = Math.round(spot.src.y * imgH);
      const dstM = this.sampleBorderMean(data, cx, cy, radius, imgW, imgH);
      const srcM = this.sampleBorderMean(data, scx, scy, radius, imgW, imgH);
      return [(dstM.r - srcM.r) / 255, (dstM.g - srcM.g) / 255, (dstM.b - srcM.b) / 255];
    }

    return [0, 0, 0];
  }

  /**
   * Auto-find the best source circle for a given destination.
   *
   * Searches 8 directions at two distances and picks the region with the
   * lowest luminance variance (smoothest / most uniform area).
   *
   * @returns pixel-space { x, y }
   */
  static autoFindSource(
    data: Uint8ClampedArray,
    dstX: number,
    dstY: number,
    radius: number,
    w: number,
    h: number,
  ): { x: number; y: number } {
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    const searchDist = radius * 3.5;

    for (let angleDeg = 0; angleDeg < 360; angleDeg += 45) {
      const angle = (angleDeg * Math.PI) / 180;
      for (const distFactor of [0.7, 1.0]) {
        const cx = Math.round(dstX + Math.cos(angle) * searchDist * distFactor);
        const cy = Math.round(dstY + Math.sin(angle) * searchDist * distFactor);

        if (cx - radius < 0 || cx + radius >= w || cy - radius < 0 || cy + radius >= h) continue;

        const score = this.regionVariance(data, cx, cy, radius, w, h);
        candidates.push({ x: cx, y: cy, score });
      }
    }

    if (candidates.length === 0) {
      return {
        x: Math.max(radius, Math.min(w - 1 - radius, Math.round(dstX + radius * 3))),
        y: dstY,
      };
    }

    candidates.sort((a, b) => a.score - b.score);
    return { x: candidates[0].x, y: candidates[0].y };
  }

  /** Luminance variance of pixels inside a circle. Lower = smoother area. */
  private static regionVariance(
    data: Uint8ClampedArray,
    cx: number,
    cy: number,
    radius: number,
    w: number,
    h: number,
  ): number {
    let sum = 0,
      sumSq = 0,
      count = 0;
    const r2 = radius * radius;
    const x0 = Math.max(0, cx - radius);
    const x1 = Math.min(w - 1, cx + radius);
    const y0 = Math.max(0, cy - radius);
    const y1 = Math.min(h - 1, cy + radius);

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dist2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (dist2 > r2) continue;
        const idx = (py * w + px) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        sum += lum;
        sumSq += lum * lum;
        count++;
      }
    }

    if (count === 0) return Infinity;
    const mean = sum / count;
    return sumSq / count - mean * mean;
  }
}
