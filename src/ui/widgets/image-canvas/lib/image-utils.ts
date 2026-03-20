import exifr from 'exifr';

export const DEFAULT_THUMBNAIL_MAX_WIDTH = 400;
export const DEFAULT_THUMBNAIL_MAX_HEIGHT = 400;

/**
 * Read EXIF orientation from an ArrayBuffer using exifr.
 */
export async function readExifOrientation(buf: ArrayBuffer): Promise<number> {
  try {
    const exif = await exifr.parse(buf, { pick: ['Orientation'] });
    return exif?.Orientation ?? 1;
  } catch {
    return 1;
  }
}

export function drawBitmapWithOrientation(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  orientation: number,
): { w: number; h: number } {
  const bw = bmp.width;
  const bh = bmp.height;
  const swap = orientation >= 5 && orientation <= 8;
  const cw = swap ? bh : bw;
  const ch = swap ? bw : bh;
  ctx.canvas.width = cw;
  ctx.canvas.height = ch;
  ctx.save();
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, bw, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, bw, bh);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, bh);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, bh, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, bh, bw);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, bw);
      break;
  }
  ctx.drawImage(bmp, 0, 0);
  ctx.restore();
  return { w: cw, h: ch };
}

export async function generateThumbnailDataUrl(
  dataUrl: string,
  orientation: number,
  maxWidth = DEFAULT_THUMBNAIL_MAX_WIDTH,
  maxHeight = DEFAULT_THUMBNAIL_MAX_HEIGHT,
  quality = 0.8,
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  return generateThumbnailDataUrlFromBlob(blob, orientation, maxWidth, maxHeight, quality);
}

export async function generateThumbnailDataUrlFromArrayBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
  orientation: number,
  maxWidth = DEFAULT_THUMBNAIL_MAX_WIDTH,
  maxHeight = DEFAULT_THUMBNAIL_MAX_HEIGHT,
  quality = 0.8,
): Promise<string> {
  return generateThumbnailDataUrlFromBlob(
    new Blob([buffer], { type: mimeType }),
    orientation,
    maxWidth,
    maxHeight,
    quality,
  );
}

export async function generateThumbnailDataUrlFromBlob(
  blob: Blob,
  orientation: number,
  maxWidth = DEFAULT_THUMBNAIL_MAX_WIDTH,
  maxHeight = DEFAULT_THUMBNAIL_MAX_HEIGHT,
  quality = 0.8,
): Promise<string> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'none' });

  try {
    const orientedCanvas = document.createElement('canvas');
    const orientedCtx = orientedCanvas.getContext('2d');
    if (!orientedCtx) return '';

    const { w, h } = drawBitmapWithOrientation(orientedCtx, bmp, orientation);
    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    if (outW === w && outH === h) {
      return orientedCanvas.toDataURL('image/jpeg', quality);
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = outW;
    thumbCanvas.height = outH;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (!thumbCtx) return '';
    thumbCtx.imageSmoothingEnabled = true;
    thumbCtx.imageSmoothingQuality = 'high';
    thumbCtx.drawImage(orientedCanvas, 0, 0, outW, outH);
    return thumbCanvas.toDataURL('image/jpeg', quality);
  } finally {
    bmp.close();
  }
}

export function arrayBufferToBlob(buffer: ArrayBuffer, mimeType: string): Blob {
  return new Blob([buffer], { type: mimeType });
}

/** Decode a data-URL to a Blob for createImageBitmap. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const mimeType = dataUrl.split(';')[0].slice(5) || 'image/jpeg';
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Decode a data-URL to an ArrayBuffer for EXIF parsing. */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return buf;
}
