type Point = { x: number; y: number };

export function monotonicCubicSpline(points: Point[]): (x: number) => number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;

  if (n === 0) return () => 0;
  if (n === 1) return () => sorted[0].y;
  if (n === 2) {
    const dx = sorted[1].x - sorted[0].x;
    const dy = sorted[1].y - sorted[0].y;
    return (x) => {
      const t = dx === 0 ? 0 : Math.max(0, Math.min(1, (x - sorted[0].x) / dx));
      return Math.max(0, Math.min(1, sorted[0].y + t * dy));
    };
  }

  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  const ds: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    ds.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  const ms: number[] = new Array(n);
  ms[0] = ds[0];
  ms[n - 1] = ds[n - 2];
  for (let i = 1; i < n - 1; i++) {
    ms[i] = (ds[i - 1] + ds[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(ds[i]) < 1e-10) {
      ms[i] = 0;
      ms[i + 1] = 0;
    } else {
      const alpha = ms[i] / ds[i];
      const beta = ms[i + 1] / ds[i];
      const sq = alpha * alpha + beta * beta;
      if (sq > 9) {
        const tau = 3 / Math.sqrt(sq);
        ms[i] = tau * alpha * ds[i];
        ms[i + 1] = tau * beta * ds[i];
      }
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return Math.max(0, Math.min(1, ys[0]));
    if (x >= xs[n - 1]) return Math.max(0, Math.min(1, ys[n - 1]));

    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid + 1] < x) lo = mid + 1;
      else hi = mid;
    }
    const i = lo;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const y = h00 * ys[i] + h10 * h * ms[i] + h01 * ys[i + 1] + h11 * h * ms[i + 1];
    return Math.max(0, Math.min(1, y));
  };
}

/**
 * Build a parametric offset function from slider values + zone splits.
 * Each slider bends the curve in its zone using a smooth cosine bell.
 * Returns (x: 0-1) => y-offset (-1 to 1).
 */
export function buildParametricOffset(
  parametric: { shadows: number; darks: number; lights: number; highlights: number },
  splits: [number, number, number],
): (x: number) => number {
  const MAX_BEND = 0.35;
  const zones = [
    { value: parametric.shadows, start: 0, end: splits[0] },
    { value: parametric.darks, start: splits[0], end: splits[1] },
    { value: parametric.lights, start: splits[1], end: splits[2] },
    { value: parametric.highlights, start: splits[2], end: 1 },
  ];

  return (x: number) => {
    let offset = 0;
    for (const zone of zones) {
      if (zone.value === 0) continue;
      const center = (zone.start + zone.end) / 2;
      const halfWidth = (zone.end - zone.start) / 2;
      // Extend 40% beyond zone boundary for smooth blending
      const extended = halfWidth * 1.4;
      const dist = Math.abs(x - center);
      if (dist >= extended) continue;
      const bump = (1 + Math.cos((Math.PI * dist) / extended)) / 2;
      offset += (zone.value / 100) * MAX_BEND * bump;
    }
    return offset;
  };
}

/** Generate 256-entry LUT (values 0-255) from control points + optional parametric offset. */
export function generateLUT(points: Point[], offset?: (x: number) => number): Uint8Array {
  const fn = monotonicCubicSpline(points);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    const base = fn(x);
    const y = offset ? Math.max(0, Math.min(1, base + offset(x))) : base;
    lut[i] = Math.round(y * 255);
  }
  return lut;
}

/** Combined LUT: channelLut applied after rgbLut. combined[i] = channelLut[rgbLut[i]] */
export function combineLUTs(rgbLut: Uint8Array, channelLut: Uint8Array): Uint8Array {
  const result = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    result[i] = channelLut[rgbLut[i]];
  }
  return result;
}
