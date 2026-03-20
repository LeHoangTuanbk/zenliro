import { nativeImage } from 'electron';

/**
 * Apply EXIF orientation to a nativeImage, returning a correctly-oriented image.
 * Handles all 8 EXIF orientations including flips and rotations.
 */
export function applyOrientation(img: Electron.NativeImage, orientation: number): Electron.NativeImage {
  if (orientation <= 1 || orientation > 8) return img;

  const { width: w, height: h } = img.getSize();
  const src = img.toBitmap(); // BGRA pixel buffer

  // For orientations 5-8, width/height swap
  const swap = orientation >= 5;
  const dstW = swap ? h : w;
  const dstH = swap ? w : h;
  const dst = Buffer.alloc(dstW * dstH * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      let dx: number, dy: number;

      switch (orientation) {
        case 2: dx = w - 1 - x; dy = y; break;       // flip horizontal
        case 3: dx = w - 1 - x; dy = h - 1 - y; break; // rotate 180
        case 4: dx = x; dy = h - 1 - y; break;         // flip vertical
        case 5: dx = y; dy = x; break;                  // transpose
        case 6: dx = h - 1 - y; dy = x; break;          // rotate 90 CW
        case 7: dx = h - 1 - y; dy = w - 1 - x; break;  // transverse
        case 8: dx = y; dy = w - 1 - x; break;           // rotate 270 CW
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

/**
 * Read EXIF orientation from a JPEG/TIFF buffer.
 * Returns 1-8 (EXIF orientation tag), or 1 if not found.
 * Only reads the minimal bytes needed — no external dependencies.
 */
export function readExifOrientation(buf: Buffer): number {
  // JPEG: starts with FF D8
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return readJpegOrientation(buf);
  }
  return 1;
}

function readJpegOrientation(buf: Buffer): number {
  let offset = 2;
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) return 1;
    const marker = buf[offset + 1];

    // APP1 marker (EXIF)
    if (marker === 0xe1) {
      const segLen = buf.readUInt16BE(offset + 2);
      const exifHeader = buf.toString('ascii', offset + 4, offset + 8);
      if (exifHeader === 'Exif') {
        return parseExifOrientation(buf, offset + 10);
      }
      offset += 2 + segLen;
      continue;
    }

    // SOS marker — stop searching
    if (marker === 0xda) return 1;

    // Skip other markers
    if (marker === 0xd0 || marker === 0xd1 || marker === 0xd2 || marker === 0xd3 ||
        marker === 0xd4 || marker === 0xd5 || marker === 0xd6 || marker === 0xd7 ||
        marker === 0xd8 || marker === 0xd9) {
      offset += 2;
    } else {
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }
  return 1;
}

function parseExifOrientation(buf: Buffer, tiffStart: number): number {
  if (tiffStart + 8 > buf.length) return 1;

  const byteOrder = buf.toString('ascii', tiffStart, tiffStart + 2);
  const le = byteOrder === 'II'; // Intel = little-endian

  const read16 = (off: number) => le ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
  const read32 = (off: number) => le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);

  const ifdOffset = read32(tiffStart + 4);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > buf.length) return 1;

  const entryCount = read16(ifdStart);

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > buf.length) return 1;

    const tag = read16(entryOffset);
    if (tag === 0x0112) {
      // Orientation tag
      return read16(entryOffset + 8);
    }
  }

  return 1;
}
