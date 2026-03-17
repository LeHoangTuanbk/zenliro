import type { HealSpot } from '../model/types';

/**
 * Canvas 2D pixel-level heal/clone engine.
 *
 * Heal mode:  copies source texture while color-correcting it to match the
 *             luminosity/chrominance of the destination border — a simplified
 *             Poisson-blend approximation.
 * Clone mode: straight pixel copy with smooth feathering.
 */
export class HealEngine {
  /**
   * Apply all spots to a copy of imageData and return the result.
   * Spots are applied in insertion order so earlier spots can be sources
   * for later ones.
   */
  static applySpots(imageData: ImageData, spots: HealSpot[]): ImageData {
    if (spots.length === 0) return imageData;

    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );

    for (const spot of spots) {
      this.applyOneSpot(result, spot);
    }

    return result;
  }

  private static applyOneSpot(imageData: ImageData, spot: HealSpot): void {
    const { width: w, height: h, data } = imageData;

    const dstCx = Math.round(spot.dst.x * w);
    const dstCy = Math.round(spot.dst.y * h);
    const srcCx = Math.round(spot.src.x * w);
    const srcCy = Math.round(spot.src.y * h);
    const radius = Math.max(1, Math.round(spot.radius * w));
    const opacityNorm = spot.opacity / 100;

    if (radius < 1) return;

    // feather zone: how much of the outer ring is blended
    const hardRadius = radius * (1 - spot.feather / 100);
    const featherZone = Math.max(radius - hardRadius, 0.001);

    // Heal mode: compute color offset by comparing border mean colors
    let dr = 0, dg = 0, db = 0;
    if (spot.mode === 'heal') {
      const dstMean = this.sampleBorderMean(data, dstCx, dstCy, radius, w, h);
      const srcMean = this.sampleBorderMean(data, srcCx, srcCy, radius, w, h);
      dr = dstMean.r - srcMean.r;
      dg = dstMean.g - srcMean.g;
      db = dstMean.b - srcMean.b;
    }

    const x0 = Math.max(0, dstCx - radius);
    const x1 = Math.min(w - 1, dstCx + radius);
    const y0 = Math.max(0, dstCy - radius);
    const y1 = Math.min(h - 1, dstCy + radius);

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - dstCx;
        const dy = py - dstCy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        // Smoothstep feather alpha
        let alpha: number;
        if (dist <= hardRadius) {
          alpha = 1;
        } else {
          const t = (dist - hardRadius) / featherZone;
          alpha = 1 - t * t * (3 - 2 * t); // smoothstep
        }
        alpha *= opacityNorm;
        if (alpha <= 0) continue;

        const spx = Math.max(0, Math.min(w - 1, Math.round(srcCx + dx)));
        const spy = Math.max(0, Math.min(h - 1, Math.round(srcCy + dy)));

        const dstIdx = (py * w + px) * 4;
        const srcIdx = (spy * w + spx) * 4;

        const origR = data[dstIdx];
        const origG = data[dstIdx + 1];
        const origB = data[dstIdx + 2];

        // For heal: apply color correction with slight distance weighting
        // (correction is stronger near the center, tapering toward zero at edge)
        const healWeight = spot.mode === 'heal' ? (1 - dist / radius) * 0.6 + 0.4 : 0;
        const srcR = data[srcIdx]     + dr * healWeight;
        const srcG = data[srcIdx + 1] + dg * healWeight;
        const srcB = data[srcIdx + 2] + db * healWeight;

        data[dstIdx]     = Math.round(origR + (srcR - origR) * alpha);
        data[dstIdx + 1] = Math.round(origG + (srcG - origG) * alpha);
        data[dstIdx + 2] = Math.round(origB + (srcB - origB) * alpha);
        // alpha channel unchanged
      }
    }
  }

  /**
   * Sample the mean color of the border annulus (75%–100% of radius).
   */
  private static sampleBorderMean(
    data: Uint8ClampedArray,
    cx: number,
    cy: number,
    radius: number,
    w: number,
    h: number,
  ): { r: number; g: number; b: number } {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
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
    let sum = 0, sumSq = 0, count = 0;
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
