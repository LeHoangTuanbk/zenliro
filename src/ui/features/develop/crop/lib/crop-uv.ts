import type { CropState } from '../store/types';
import { DEFAULT_CROP_STATE } from '../store/types';

export type Uv = { x: number; y: number };

const resolve = (crop: CropState | null | undefined) => crop ?? DEFAULT_CROP_STATE;

const rotSteps = (c: CropState) => ((c.rotationSteps % 4) + 4) % 4;

/** Crop uniforms as uploaded to the main shader (texture Y-up). */
function cropUniforms(crop: CropState | null | undefined) {
  const c = resolve(crop);
  return {
    originX: c.rect.x,
    originY: 1 - c.rect.y - c.rect.h,
    sizeX: c.rect.w,
    sizeY: c.rect.h,
    rotation: (-c.rotation * Math.PI) / 180,
    rotSteps: rotSteps(c),
    flipH: c.flipH,
    flipV: c.flipV,
  };
}

/** Rotated-image size (before crop), in units of image height. */
function rotatedSize(crop: CropState | null | undefined, imgAspect: number) {
  const odd = rotSteps(resolve(crop)) % 2 === 1;
  return { w: odd ? 1 : imgAspect, h: odd ? imgAspect : 1 };
}

/** Width / height of the visible (cropped) area. */
export function displayAspect(crop: CropState | null | undefined, imgAspect: number) {
  const c = resolve(crop);
  const r = rotatedSize(crop, imgAspect);
  return (c.rect.w * r.w) / (c.rect.h * r.h);
}

/** Width of the visible area expressed as a fraction of the original image width. */
export function displayWidthInImageWidths(crop: CropState | null | undefined, imgAspect: number) {
  return (resolve(crop).rect.w * rotatedSize(crop, imgAspect).w) / imgAspect;
}

function rotate2(x: number, y: number, cosR: number, sinR: number): Uv {
  return { x: cosR * x - sinR * y, y: sinR * x + cosR * y };
}

/** Display UV (v_texCoord, Y-up) → original image UV (texture Y-up). Mirrors main/entry.glsl. */
export function displayToImageUv(
  display: Uv,
  crop: CropState | null | undefined,
  imgAspect: number,
): Uv {
  const u = cropUniforms(crop);
  let x = u.originX + display.x * u.sizeX;
  let y = u.originY + display.y * u.sizeY;

  if (u.rotation !== 0) {
    const cx = 0.5;
    const cy = 0.5;
    const aspect = u.rotSteps % 2 === 1 ? 1 / imgAspect : imgAspect;
    const rd = rotate2((x - cx) * aspect, y - cy, Math.cos(-u.rotation), Math.sin(-u.rotation));
    x = cx + rd.x / aspect;
    y = cy + rd.y;
  }

  if (u.flipH) x = 1 - x;
  if (u.flipV) y = 1 - y;

  const tx = x;
  const ty = y;
  if (u.rotSteps === 1) [x, y] = [1 - ty, tx];
  else if (u.rotSteps === 2) [x, y] = [1 - tx, 1 - ty];
  else if (u.rotSteps === 3) [x, y] = [ty, 1 - tx];

  return { x, y };
}

/** Original image UV (texture Y-up) → display UV (v_texCoord, Y-up). Inverse of displayToImageUv. */
export function imageToDisplayUv(
  image: Uv,
  crop: CropState | null | undefined,
  imgAspect: number,
): Uv {
  const u = cropUniforms(crop);
  let x = image.x;
  let y = image.y;

  const tx = x;
  const ty = y;
  if (u.rotSteps === 1) [x, y] = [ty, 1 - tx];
  else if (u.rotSteps === 2) [x, y] = [1 - tx, 1 - ty];
  else if (u.rotSteps === 3) [x, y] = [1 - ty, tx];

  if (u.flipH) x = 1 - x;
  if (u.flipV) y = 1 - y;

  if (u.rotation !== 0) {
    const cx = 0.5;
    const cy = 0.5;
    const aspect = u.rotSteps % 2 === 1 ? 1 / imgAspect : imgAspect;
    const rd = rotate2((x - cx) * aspect, y - cy, Math.cos(u.rotation), Math.sin(u.rotation));
    x = cx + rd.x / aspect;
    y = cy + rd.y;
  }

  return {
    x: u.sizeX !== 0 ? (x - u.originX) / u.sizeX : 0,
    y: u.sizeY !== 0 ? (y - u.originY) / u.sizeY : 0,
  };
}

/** Overlay UV (Y-down, 0–1 of visible area) → stored mask UV (Y-down, 0–1 of original image). */
export function screenToBrushUv(
  screen: Uv,
  crop: CropState | null | undefined,
  imgAspect: number,
): Uv {
  const image = displayToImageUv({ x: screen.x, y: 1 - screen.y }, crop, imgAspect);
  return { x: image.x, y: 1 - image.y };
}

/** Stored mask UV (Y-down, original image) → overlay UV (Y-down, visible area). */
export function brushToScreenUv(
  brush: Uv,
  crop: CropState | null | undefined,
  imgAspect: number,
): Uv {
  const display = imageToDisplayUv({ x: brush.x, y: 1 - brush.y }, crop, imgAspect);
  return { x: display.x, y: 1 - display.y };
}
