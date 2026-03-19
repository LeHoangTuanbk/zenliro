import type { BrushStroke } from '../store/types';

/**
 * Renders brush strokes onto an offscreen Canvas 2D and returns a
 * grayscale Uint8Array (one byte per pixel, 0-255) suitable for uploading
 * to a WebGL R8 texture.
 */
export function renderBrushMask(
  strokes: BrushStroke[],
  imageW: number,
  imageH: number,
): Uint8Array {
  const canvas = new OffscreenCanvas(imageW, imageH);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, imageW, imageH);

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    const sizePx = stroke.size * imageW;
    const alpha = stroke.opacity;

    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';

    if (stroke.points.length === 1) {
      paintDot(ctx, stroke.points[0].x * imageW, stroke.points[0].y * imageH, sizePx, stroke.feather, alpha);
      continue;
    }

    for (let i = 0; i < stroke.points.length; i++) {
      const px = stroke.points[i].x * imageW;
      const py = stroke.points[i].y * imageH;
      paintDot(ctx, px, py, sizePx, stroke.feather, alpha);

      if (i > 0) {
        // Interpolate dots between previous and current point for smooth strokes
        const prev = stroke.points[i - 1];
        const ppx = prev.x * imageW;
        const ppy = prev.y * imageH;
        const dist = Math.hypot(px - ppx, py - ppy);
        const steps = Math.max(1, Math.floor(dist / (sizePx * 0.2)));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          paintDot(ctx, ppx + (px - ppx) * t, ppy + (py - ppy) * t, sizePx, stroke.feather, alpha);
        }
      }
    }
  }

  const imageData = ctx.getImageData(0, 0, imageW, imageH);
  // Extract alpha channel only (brush paints to alpha)
  const result = new Uint8Array(imageW * imageH);
  for (let i = 0; i < result.length; i++) {
    result[i] = imageData.data[i * 4 + 3]; // alpha channel
  }
  return result;
}

function paintDot(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  sizePx: number,
  feather: number, // 0-1
  opacity: number, // 0-1
): void {
  const r = sizePx / 2;
  const hardR = r * (1 - feather);

  const grad = ctx.createRadialGradient(x, y, hardR, x, y, r);
  grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
