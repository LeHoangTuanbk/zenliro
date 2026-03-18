export function readExifOrientationFromBuffer(buf: ArrayBuffer): number {
  try {
    const view = new DataView(buf);
    const len = Math.min(buf.byteLength, 65536);
    let off = 2;
    while (off + 4 < len) {
      if (view.getUint8(off) !== 0xff) break;
      const marker = view.getUint8(off + 1);
      const segLen = view.getUint16(off + 2);
      if (marker === 0xe1 && segLen >= 8) {
        if (view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0) {
          const tiff = off + 10;
          const le = view.getUint8(tiff) === 0x49;
          const ifdOff = view.getUint32(tiff + 4, le);
          const entries = view.getUint16(tiff + ifdOff, le);
          for (let i = 0; i < entries; i++) {
            const ep = tiff + ifdOff + 2 + i * 12;
            const tag = view.getUint16(ep, le);
            if (tag === 0x0112) return view.getUint16(ep + 8, le);
          }
        }
      }
      off += 2 + segLen;
    }
  } catch {
    /* ignore */
  }
  return 1;
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

/** Decode a data-URL to a Blob for createImageBitmap. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const mimeType = dataUrl.split(';')[0].slice(5) || 'image/jpeg';
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Slice first 64 KB of a data-URL into an ArrayBuffer for EXIF((Exchangeable Image File Format) parsing. */
export function dataUrlToPartialBuffer(dataUrl: string): ArrayBuffer {
  const b64 = dataUrl.split(',')[1];
  const slice = b64.slice(0, 87382);
  const bin = atob(slice);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return buf;
}
