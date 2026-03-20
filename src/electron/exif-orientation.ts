import { nativeImage } from 'electron';
import exifr from 'exifr';

/**
 * Read EXIF orientation from a file buffer using exifr.
 * Returns 1-8 (EXIF orientation tag), or 1 if not found.
 */
export async function readExifOrientation(buf: Buffer): Promise<number> {
  try {
    const exif = await exifr.parse(buf, { pick: ['Orientation'] });
    return exif?.Orientation ?? 1;
  } catch {
    return 1;
  }
}

/**
 * Read raw pixel dimensions from EXIF (before any orientation transform).
 * Returns { width, height } or null if unavailable.
 */
export async function readExifDimensions(buf: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const exif = await exifr.parse(buf, { pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
    const w = exif?.ExifImageWidth ?? exif?.ImageWidth;
    const h = exif?.ExifImageHeight ?? exif?.ImageHeight;
    if (w && h) return { width: w, height: h };
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if nativeImage already applied EXIF orientation by comparing
 * its dimensions with raw EXIF dimensions and the orientation tag.
 */
export function isAlreadyOriented(
  imgSize: { width: number; height: number },
  rawDims: { width: number; height: number } | null,
  orientation: number,
): boolean {
  if (!rawDims || orientation <= 1 || orientation > 8) return false;
  const shouldSwap = orientation >= 5 && orientation <= 8;
  if (!shouldSwap) return false;
  // If orientation says swap but nativeImage dimensions are already swapped
  // (width < height when raw is width > height, or vice versa), it was auto-applied
  const rawIsLandscape = rawDims.width > rawDims.height;
  const imgIsLandscape = imgSize.width > imgSize.height;
  return rawIsLandscape !== imgIsLandscape;
}

/**
 * Apply EXIF orientation to a nativeImage, returning a correctly-oriented image.
 * Handles all 8 EXIF orientations including flips and rotations.
 */
export function applyOrientation(img: Electron.NativeImage, orientation: number): Electron.NativeImage {
  if (orientation <= 1 || orientation > 8) return img;

  const { width: w, height: h } = img.getSize();
  const src = img.toBitmap(); // BGRA pixel buffer

  const swap = orientation >= 5;
  const dstW = swap ? h : w;
  const dstH = swap ? w : h;
  const dst = Buffer.alloc(dstW * dstH * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      let dx: number, dy: number;

      switch (orientation) {
        case 2: dx = w - 1 - x; dy = y; break;
        case 3: dx = w - 1 - x; dy = h - 1 - y; break;
        case 4: dx = x; dy = h - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = h - 1 - y; dy = x; break;
        case 7: dx = h - 1 - y; dy = w - 1 - x; break;
        case 8: dx = y; dy = w - 1 - x; break;
        default: dx = x; dy = y;
      }

      const dstIdx = (dy * dstW + dx) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return nativeImage.createFromBitmap(dst, { width: dstW, height: dstH });
}
