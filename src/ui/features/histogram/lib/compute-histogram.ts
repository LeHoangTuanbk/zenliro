export type HistogramData = {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
};

const MAX_HISTOGRAM_SAMPLES = 160_000;
const GPU_HISTOGRAM_MAX_EDGE = 512;

type HistogramSource = ImageBitmap | HTMLImageElement;

type HistogramWebGLState = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  texture: WebGLTexture;
  positionLocation: number;
  texCoordLocation: number;
};

let histogramWebGLState: HistogramWebGLState | null | undefined;

/** Compute per-channel histogram from an ImageData */
export function computeHistogram(
  data: Uint8ClampedArray,
  width?: number,
  height?: number,
  maxSamples = MAX_HISTOGRAM_SAMPLES,
): HistogramData {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);

  if (width && height) {
    const totalPixels = width * height;
    const step = totalPixels > maxSamples
      ? Math.max(1, Math.ceil(Math.sqrt(totalPixels / maxSamples)))
      : 1;

    for (let y = 0; y < height; y += step) {
      const rowOffset = (y * width) * 4;
      for (let x = 0; x < width; x += step) {
        const idx = rowOffset + x * 4;
        r[data[idx]]++;
        g[data[idx + 1]]++;
        b[data[idx + 2]]++;
      }
    }

    return { r, g, b };
  }

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
  }

  return { r, g, b };
}

export async function histogramFromDataUrl(dataUrl: string): Promise<HistogramData> {
  if (typeof createImageBitmap === 'function') {
    return histogramFromBlob(dataUrlToBlob(dataUrl));
  }

  return histogramFromImageUrl(dataUrl);
}

export function histogramFromArrayBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<HistogramData> {
  return histogramFromBlob(new Blob([buffer], { type: mimeType }));
}

export function histogramFromImageUrl(imageUrl: string): Promise<HistogramData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        resolve(await histogramFromSource(img, img.naturalWidth, img.naturalHeight));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image for histogram: ${imageUrl}`));
    img.src = imageUrl;
  });
}

async function histogramFromBlob(blob: Blob): Promise<HistogramData> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try {
      return await histogramFromSource(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await histogramFromImageUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function histogramFromSource(
  source: HistogramSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<HistogramData> {
  const { width, height } = getHistogramTargetSize(sourceWidth, sourceHeight);
  const gpuPixels = renderPixelsWithWebGL(source, width, height);
  if (gpuPixels) {
    return computeHistogram(new Uint8ClampedArray(gpuPixels.buffer), width, height);
  }

  const cpuPixels = renderPixelsWithCanvas2D(source, width, height);
  return computeHistogram(cpuPixels.data, width, height);
}

function getHistogramTargetSize(sourceWidth: number, sourceHeight: number) {
  const maxEdge = Math.max(sourceWidth, sourceHeight);
  const scale = maxEdge > GPU_HISTOGRAM_MAX_EDGE
    ? GPU_HISTOGRAM_MAX_EDGE / maxEdge
    : 1;

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function renderPixelsWithCanvas2D(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create 2D context for histogram');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function renderPixelsWithWebGL(
  source: TexImageSource,
  width: number,
  height: number,
): Uint8Array | null {
  const state = getHistogramWebGLState();
  if (!state) return null;

  const { canvas, gl, program, positionBuffer, texCoordBuffer, texture, positionLocation, texCoordLocation } = state;

  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  } catch {
    return null;
  }

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

function getHistogramWebGLState(): HistogramWebGLState | null {
  if (histogramWebGLState !== undefined) {
    return histogramWebGLState ?? null;
  }

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) ?? canvas.getContext('webgl', {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });

  if (!gl) {
    histogramWebGLState = null;
    return null;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;

    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `);

  if (!vertexShader || !fragmentShader) {
    histogramWebGLState = null;
    return null;
  }

  const program = createProgram(gl, vertexShader, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!program) {
    histogramWebGLState = null;
    return null;
  }

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
  if (positionLocation < 0 || texCoordLocation < 0) {
    histogramWebGLState = null;
    return null;
  }

  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!positionBuffer || !texCoordBuffer || !texture) {
    histogramWebGLState = null;
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW,
  );

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.useProgram(program);
  const imageLocation = gl.getUniformLocation(program, 'u_image');
  gl.uniform1i(imageLocation, 0);

  histogramWebGLState = {
    canvas,
    gl,
    program,
    positionBuffer,
    texCoordBuffer,
    texture,
    positionLocation,
    texCoordLocation,
  };

  return histogramWebGLState;
}

function createShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }
  gl.deleteShader(shader);
  return null;
}

function createProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program;
  }
  gl.deleteProgram(program);
  return null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ''] = dataUrl.split(',');
  const mimeType = header.split(';')[0]?.slice(5) || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
