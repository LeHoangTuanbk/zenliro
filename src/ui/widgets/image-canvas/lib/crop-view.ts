import { cropBounds, type CropState } from '@/features/develop/crop';

/**
 * Crop state the renderer should use. While editing, the canvas shows the straightened
 * image's bounding box so corners rotated past the original frame stay reachable.
 */
export function viewCropState(
  editing: CropState | null | undefined,
  confirmed: CropState | null | undefined,
  imgW: number,
  imgH: number,
): CropState | null {
  if (!editing) return confirmed ?? null;
  const hasTransform =
    editing.flipH || editing.flipV || editing.rotationSteps !== 0 || editing.rotation !== 0;
  if (!hasTransform || !imgW || !imgH) return null;
  return { ...editing, rect: cropBounds(editing, imgW / imgH) };
}

/** Source-pixel size of what the canvas displays. */
export function viewSourceSize(view: CropState | null, imgW: number, imgH: number) {
  const swap = (view?.rotationSteps ?? 0) % 2 !== 0;
  const rotW = swap ? imgH : imgW;
  const rotH = swap ? imgW : imgH;
  return view ? { w: rotW * view.rect.w, h: rotH * view.rect.h } : { w: rotW, h: rotH };
}
