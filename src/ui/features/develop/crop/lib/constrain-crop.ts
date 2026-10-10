import type { CropRect, CropState } from '../store/types';

const EPS = 1e-6;
const SEARCH_ITERATIONS = 24;

/**
 * Rotated view (after 90° steps), Y-down, image height = 1, width = `a`.
 * The straightened image is the same-size rectangle rotated about the view center.
 */
type Frame = { a: number; cos: number; sin: number };

function frameOf(crop: CropState, imgAspect: number): Frame {
  const odd = Math.abs(crop.rotationSteps % 2) === 1;
  const rad = (crop.rotation * Math.PI) / 180;
  return { a: odd ? 1 / imgAspect : imgAspect, cos: Math.cos(rad), sin: Math.sin(rad) };
}

/** View-space vector → straightened-image local axes. */
function toLocal(f: Frame, dx: number, dy: number) {
  return { x: f.cos * dx + f.sin * dy, y: -f.sin * dx + f.cos * dy };
}

function fromLocal(f: Frame, qx: number, qy: number) {
  return { x: f.cos * qx - f.sin * qy, y: f.sin * qx + f.cos * qy };
}

/**
 * Same-size rect closest to `r` that fits. Valid centers form a rectangle in the image's
 * local axes, so clamping there slides smoothly along slanted edges.
 */
function slideInside(f: Frame, r: CropRect): CropRect {
  const hx = (r.w * f.a) / 2;
  const hy = r.h / 2;
  const reach = toLocal(f, hx, hy);
  const reach2 = toLocal(f, hx, -hy);
  const limX = Math.max(0, f.a / 2 - Math.max(Math.abs(reach.x), Math.abs(reach2.x)));
  const limY = Math.max(0, 0.5 - Math.max(Math.abs(reach.y), Math.abs(reach2.y)));
  const c = toLocal(f, (r.x + r.w / 2 - 0.5) * f.a, r.y + r.h / 2 - 0.5);
  const d = fromLocal(
    f,
    Math.max(-limX, Math.min(limX, c.x)),
    Math.max(-limY, Math.min(limY, c.y)),
  );
  return { ...r, x: 0.5 + d.x / f.a - r.w / 2, y: 0.5 + d.y - r.h / 2 };
}

/** Largest k such that `|a + k·b| ≤ limit`. */
function axisLimit(a: number, b: number, limit: number) {
  if (Math.abs(a) > limit + EPS) return 0;
  if (Math.abs(b) < EPS) return Infinity;
  return b > 0 ? (limit - a) / b : (limit + a) / -b;
}

/** Largest scale (≤ 1) about the rect center that keeps every corner inside the image. */
function maxScale(f: Frame, r: CropRect) {
  const c = toLocal(f, (r.x + r.w / 2 - 0.5) * f.a, r.y + r.h / 2 - 0.5);
  const hx = (r.w * f.a) / 2;
  const hy = r.h / 2;
  let k = 1;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const b = toLocal(f, sx * hx, sy * hy);
      k = Math.min(k, axisLimit(c.x, b.x, f.a / 2), axisLimit(c.y, b.y, 0.5));
    }
  }
  return Math.max(0, k);
}

const fits = (f: Frame, r: CropRect) => maxScale(f, r) >= 1 - EPS;

function scaleAboutCenter(r: CropRect, k: number): CropRect {
  const w = r.w * k;
  const h = r.h * k;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/** Shrink (never grow) the rect about its center until it lies inside the straightened image. */
function fitRect(f: Frame, r: CropRect): CropRect {
  const k = maxScale(f, r);
  if (k > EPS) return scaleAboutCenter(r, k);
  const centered = { ...r, x: 0.5 - r.w / 2, y: 0.5 - r.h / 2 };
  return scaleAboutCenter(centered, maxScale(f, centered));
}

const lerpRect = (a: CropRect, b: CropRect, t: number): CropRect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

/** Move from a valid rect toward the target, stopping at the image edge. */
function advance(f: Frame, from: CropRect, to: CropRect): CropRect {
  if (fits(f, to)) return to;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (fits(f, lerpRect(from, to, mid))) lo = mid;
    else hi = mid;
  }
  return lerpRect(from, to, lo);
}

const sameGeometry = (a: CropState, b: CropState) =>
  a.rotation === b.rotation &&
  a.rotationSteps === b.rotationSteps &&
  a.constrainToImage === b.constrainToImage;

/**
 * Bounding box of the straightened image, in crop-rect units (may exceed 0–1).
 * This is the Crop tool's work area — nothing of the rotated image lies outside it.
 */
export function cropBounds(crop: CropState, imgAspect: number): CropRect {
  const f = frameOf(crop, imgAspect);
  const c = Math.abs(f.cos);
  const s = Math.abs(f.sin);
  const w = (f.a * c + s) / f.a;
  const h = f.a * s + c;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Shrink the rect to lie within `bounds`. */
function clampToBounds(r: CropRect, b: CropRect): CropRect {
  const x = Math.max(b.x, r.x);
  const y = Math.max(b.y, r.y);
  return {
    x,
    y,
    w: Math.min(b.x + b.w, r.x + r.w) - x,
    h: Math.min(b.y + b.h, r.y + r.h) - y,
  };
}

/** Whether the rect contains no blank area of the straightened image. */
export function cropFitsImage(crop: CropState, imgAspect: number) {
  return fits(frameOf(crop, imgAspect), crop.rect);
}

/** Shrink the rect about its center until it has no blank corners (when constrained). */
export function fitCropToImage(crop: CropState, imgAspect: number): CropState {
  if (!crop.constrainToImage || !(imgAspect > 0)) return crop;
  const f = frameOf(crop, imgAspect);
  return fits(f, crop.rect) ? crop : { ...crop, rect: fitRect(f, crop.rect) };
}

/**
 * Lightroom "Constrain to Image": keep the crop inside the straightened image.
 * Rect edits stop at the image edge (moves slide along it); angle / 90° changes shrink the rect.
 */
export function constrainCrop(prev: CropState, next: CropState, imgAspect: number): CropState {
  if (!(imgAspect > 0)) return next;
  if (!next.constrainToImage) {
    return { ...next, rect: clampToBounds(next.rect, cropBounds(next, imgAspect)) };
  }
  const f = frameOf(next, imgAspect);
  if (fits(f, next.rect)) return next;
  if (!sameGeometry(prev, next) || !fits(f, prev.rect)) return fitCropToImage(next, imgAspect);

  const from = prev.rect;
  const to = next.rect;
  const isMove = Math.abs(from.w - to.w) < EPS && Math.abs(from.h - to.h) < EPS;
  return { ...next, rect: isMove ? slideInside(f, to) : advance(f, from, to) };
}
