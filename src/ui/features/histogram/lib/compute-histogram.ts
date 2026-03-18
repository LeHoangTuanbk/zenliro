export interface HistogramData {
  r: Uint32Array; // 256 bins
  g: Uint32Array;
  b: Uint32Array;
}

/** Compute per-channel histogram from an ImageData */
export function computeHistogram(data: Uint8ClampedArray): HistogramData {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
  }
  return { r, g, b };
}

/** Decode a dataUrl into pixel data using an offscreen canvas */
export function histogramFromDataUrl(dataUrl: string): Promise<HistogramData> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Downsample to max 400px wide for speed
      const scale = Math.min(1, 400 / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      resolve(computeHistogram(data));
    };
    img.src = dataUrl;
  });
}
