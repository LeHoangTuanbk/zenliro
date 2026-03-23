import LibRaw from 'libraw-wasm';

export type RawDecodeResult = {
  canvas: HTMLCanvasElement;
  imageData: ImageData;
  width: number;
  height: number;
};

export type RawThumbnailResult = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Convert interleaved RGB Uint8Array → RGBA ImageData on a canvas */
function rgbToCanvas(
  data: Uint8Array,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; imageData: ImageData } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const rgba = imageData.data;
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    rgba[j] = data[i];
    rgba[j + 1] = data[i + 1];
    rgba[j + 2] = data[i + 2];
    rgba[j + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return { canvas, imageData };
}

/**
 * Decode RAW for preview (fast): half-size + linear interpolation.
 * Good enough for editing preview, ~4-8x faster than full decode.
 */
export async function decodeRawToCanvas(buffer: ArrayBuffer): Promise<RawDecodeResult> {
  return decodeRawInternal(buffer, { halfSize: true, userQual: 0 });
}

/**
 * Decode RAW for export (quality): full-size + AHD demosaicing.
 * Slower but maximum quality for final output.
 */
export async function decodeRawFullRes(buffer: ArrayBuffer): Promise<RawDecodeResult> {
  return decodeRawInternal(buffer, { halfSize: false, userQual: 3 });
}

async function decodeRawInternal(
  buffer: ArrayBuffer,
  opts: { halfSize: boolean; userQual: number },
): Promise<RawDecodeResult> {
  const raw = new LibRaw();
  const cloned = buffer.slice(0);

  await raw.open(new Uint8Array(cloned), {
    useCameraWb: true,
    outputColor: 1, // sRGB
    outputBps: 8,
    userQual: opts.userQual,
    halfSize: opts.halfSize,
  });

  const image = await raw.imageData();
  const { width, height, data } = image;
  const { canvas, imageData } = rgbToCanvas(data, width, height);

  return { canvas, imageData, width, height };
}

/**
 * Generate a thumbnail from a RAW file using half-size decode (fast).
 * Buffer is cloned internally.
 */
export async function extractRawThumbnail(
  buffer: ArrayBuffer,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.8,
): Promise<RawThumbnailResult | null> {
  const raw = new LibRaw();
  const cloned = buffer.slice(0);

  await raw.open(new Uint8Array(cloned), {
    useCameraWb: true,
    outputColor: 1,
    outputBps: 8,
    userQual: 0, // linear (fastest)
    halfSize: true, // half resolution for speed
  });

  const image = await raw.imageData();
  const { width, height, data } = image;
  const { canvas: fullCanvas } = rgbToCanvas(data, width, height);

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = outW;
  thumbCanvas.height = outH;
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = 'high';
  thumbCtx.drawImage(fullCanvas, 0, 0, outW, outH);

  return {
    dataUrl: thumbCanvas.toDataURL('image/jpeg', quality),
    width,
    height,
  };
}
