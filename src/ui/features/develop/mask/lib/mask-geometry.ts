import type { CropState } from '@/features/develop/crop/store/types';
import type { LinearMaskData, RadialMaskData } from '../store/types';
import { brushToScreenUv, displayAspect, screenToBrushUv, type Uv } from '@/features/develop/crop';

type Crop = CropState | null | undefined;

/** Ellipse in overlay space: center/radii as fractions of the visible width/height, angle in degrees (Y-down). */
export type ScreenEllipse = { cx: number; cy: number; rx: number; ry: number; angle: number };

const DEG = 180 / Math.PI;

export function linearImageToScreen(
  d: LinearMaskData,
  crop: Crop,
  imgAspect: number,
): LinearMaskData {
  const a = brushToScreenUv({ x: d.x1, y: d.y1 }, crop, imgAspect);
  const b = brushToScreenUv({ x: d.x2, y: d.y2 }, crop, imgAspect);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, feather: d.feather };
}

export function linearScreenToImage(
  d: LinearMaskData,
  crop: Crop,
  imgAspect: number,
): LinearMaskData {
  const a = screenToBrushUv({ x: d.x1, y: d.y1 }, crop, imgAspect);
  const b = screenToBrushUv({ x: d.x2, y: d.y2 }, crop, imgAspect);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, feather: d.feather };
}

/**
 * Maps the ellipse axis endpoints through `map` and measures them in an
 * isotropic space (x scaled by `fromAspect` / `toAspect`), so straighten,
 * 90° steps and flips are all handled by the point mapping itself.
 */
function mapEllipse(
  e: ScreenEllipse,
  fromAspect: number,
  toAspect: number,
  map: (p: Uv) => Uv,
): ScreenEllipse {
  const a = e.angle / DEG;
  const rxIso = e.rx * fromAspect;
  const axisPoint = (dx: number, dy: number) => map({ x: e.cx + dx / fromAspect, y: e.cy + dy });
  const c = map({ x: e.cx, y: e.cy });
  const pu = axisPoint(Math.cos(a) * rxIso, Math.sin(a) * rxIso);
  const pv = axisPoint(-Math.sin(a) * e.ry, Math.cos(a) * e.ry);
  const ux = (pu.x - c.x) * toAspect;
  const uy = pu.y - c.y;
  const vx = (pv.x - c.x) * toAspect;
  const vy = pv.y - c.y;
  return {
    cx: c.x,
    cy: c.y,
    rx: Math.hypot(ux, uy) / toAspect,
    ry: Math.hypot(vx, vy),
    angle: Math.atan2(uy, ux) * DEG,
  };
}

export function radialImageToScreen(
  d: RadialMaskData,
  crop: Crop,
  imgAspect: number,
): ScreenEllipse {
  return mapEllipse(
    { cx: d.cx, cy: d.cy, rx: d.rx, ry: d.ry, angle: d.angle },
    imgAspect,
    displayAspect(crop, imgAspect),
    (p) => brushToScreenUv(p, crop, imgAspect),
  );
}

export function radialScreenToImage(
  e: ScreenEllipse,
  base: Pick<RadialMaskData, 'feather' | 'invert'>,
  crop: Crop,
  imgAspect: number,
): RadialMaskData {
  const m = mapEllipse(e, displayAspect(crop, imgAspect), imgAspect, (p) =>
    screenToBrushUv(p, crop, imgAspect),
  );
  return { ...base, cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry, angle: m.angle };
}
