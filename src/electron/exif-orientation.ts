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
 * Read raw pixel dimensions from the JPEG SOF (Start of Frame) marker.
 * These are ALWAYS the unrotated/raw encoded dimensions regardless of EXIF.
 * Returns null for non-JPEG files.
 */
export function readJpegRawDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xFF) break;
    const marker = buf[offset + 1];
    // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3)
    if (marker >= 0xC0 && marker <= 0xC3) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    // Standalone markers (no payload)
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      continue;
    }
    // Skip marker segment
    if (offset + 3 >= buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

export function getOrientedDimensions(
  size: { width: number; height: number },
  orientation: number,
): { width: number; height: number } {
  const swap = orientation >= 5 && orientation <= 8;
  return swap
    ? { width: size.height, height: size.width }
    : size;
}

/**
 * Determine if manual EXIF orientation is needed by comparing
 * nativeImage dimensions with JPEG raw dimensions.
 *
 * For orientation 5-8 (90°/270° rotations that swap w/h):
 *   - If imgSize matches rawDims → NOT auto-oriented → needs manual
 *   - If imgSize is swapped vs rawDims → already auto-oriented → skip
 *
 * For orientation 2-4 (flip/180°, no dimension change):
 *   - Cannot detect from dimensions. macOS createFromPath typically
 *     handles these, so skip to avoid double-apply.
 */
export function needsManualOrientation(
  imgSize: { width: number; height: number },
  rawDims: { width: number; height: number } | null,
  orientation: number,
): boolean {
  if (orientation <= 1 || orientation > 8) return false;

  // Orientation 5-8: rotation that swaps width/height
  if (orientation >= 5 && rawDims) {
    const dimsMatchRaw = imgSize.width === rawDims.width && imgSize.height === rawDims.height;
    // If dimensions still match raw → createFromPath did NOT auto-orient
    return dimsMatchRaw;
  }

  // No raw dims available or orientation 2-4: skip manual to avoid double-apply
  return false;
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
