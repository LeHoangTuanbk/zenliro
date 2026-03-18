import type { Adjustments } from '@/features/develop/edit/store/adjustments-store';
import type { CropState } from '@/features/develop/crop/store/types';
import type { SpotGPUData } from './types';
import { linkProgram, createTexture, createFBO } from './gl-utils';
import { VERT_SRC, BLUR_FRAG_SRC, HEAL_FRAG_SRC, MAIN_FRAG_SRC } from './shaders';

export class WebGLRenderer {
  private gl!: WebGL2RenderingContext;
  private blurProg!: WebGLProgram;
  private mainProg!: WebGLProgram;
  private healProg!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;

  private imageTex!: WebGLTexture;
  private smallBlurTex!: WebGLTexture;
  private smallBlurTmpTex!: WebGLTexture;
  private largeBlurTex!: WebGLTexture;
  private largeBlurTmpTex!: WebGLTexture;
  private healTex!: WebGLTexture;

  private smallBlurHFBO!: WebGLFramebuffer;
  private smallBlurFBO!: WebGLFramebuffer;
  private largeBlurHFBO!: WebGLFramebuffer;
  private largeBlurFBO!: WebGLFramebuffer;
  private healFBO!: WebGLFramebuffer;

  private imgW = 0;
  private imgH = 0;
  private ready = false;
  private spotsData: SpotGPUData[] = [];
  private cropData: CropState | null = null;

  init(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}): void {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.blurProg = linkProgram(gl, VERT_SRC, BLUR_FRAG_SRC);
    this.mainProg = linkProgram(gl, VERT_SRC, MAIN_FRAG_SRC);
    this.healProg = linkProgram(gl, VERT_SRC, HEAL_FRAG_SRC);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.blurProg, this.mainProg, this.healProg]) {
      const aPos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    this.vao = vao;
  }

  loadImage(image: HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl;
    this.imgW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    this.imgH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const w = this.imgW,
      h = this.imgH;

    if (!this.imageTex) this.imageTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.smallBlurTmpTex = createTexture(gl, w, h);
    this.smallBlurTex = createTexture(gl, w, h);
    this.largeBlurTmpTex = createTexture(gl, w, h);
    this.largeBlurTex = createTexture(gl, w, h);
    this.smallBlurHFBO = createFBO(gl, this.smallBlurTmpTex);
    this.smallBlurFBO = createFBO(gl, this.smallBlurTex);
    this.largeBlurHFBO = createFBO(gl, this.largeBlurTmpTex);
    this.largeBlurFBO = createFBO(gl, this.largeBlurTex);
    this.healTex = createTexture(gl, w, h);
    this.healFBO = createFBO(gl, this.healTex);
    this.ready = true;
  }

  setHealSpots(spots: SpotGPUData[]): void {
    this.spotsData = spots.slice(0, 32);
  }
  setCropState(crop: CropState | null): void {
    this.cropData = crop;
  }
  get isReady() {
    return this.ready;
  }

  private runHealPass(): WebGLTexture | null {
    if (this.spotsData.length === 0) return null;
    const gl = this.gl;
    const MAX = 32;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.healFBO);
    gl.viewport(0, 0, this.imgW, this.imgH);
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.healProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(gl.getUniformLocation(this.healProg, 'u_image'), 0);

    const count = this.spotsData.length;
    gl.uniform1i(gl.getUniformLocation(this.healProg, 'u_spotCount'), count);
    gl.uniform1f(gl.getUniformLocation(this.healProg, 'u_hOverW'), this.imgH / this.imgW);

    const dstSrc = new Float32Array(MAX * 4);
    const params = new Float32Array(MAX * 4);
    const color = new Float32Array(MAX * 4);
    for (let i = 0; i < count; i++) {
      const s = this.spotsData[i],
        b = i * 4;
      dstSrc[b] = s.dst.x;
      dstSrc[b + 1] = 1 - s.dst.y;
      dstSrc[b + 2] = s.src.x;
      dstSrc[b + 3] = 1 - s.src.y;
      params[b] = s.radius;
      params[b + 1] = s.feather;
      params[b + 2] = s.opacity;
      params[b + 3] = s.mode;
      color[b] = s.colorData[0];
      color[b + 1] = s.colorData[1];
      color[b + 2] = s.colorData[2];
    }
    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_dstSrc'), dstSrc);
    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_params'), params);
    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_colorData'), color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.healTex;
  }

  render(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
    if (!this.ready) return;
    const gl = this.gl;
    const activeImageTex = this.runHealPass() ?? this.imageTex;

    gl.bindVertexArray(this.vao);

    // Blur passes
    gl.useProgram(this.blurProg);
    const uStep = gl.getUniformLocation(this.blurProg, 'u_step');
    const uSrc = gl.getUniformLocation(this.blurProg, 'u_src');
    const runBlur = (
      srcTex: WebGLTexture,
      hFBO: WebGLFramebuffer,
      vFBO: WebGLFramebuffer,
      hTmpTex: WebGLTexture,
      stepScale: number,
    ) => {
      gl.viewport(0, 0, this.imgW, this.imgH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, hFBO);
      gl.uniform2f(uStep, stepScale / this.imgW, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(uSrc, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, vFBO);
      gl.uniform2f(uStep, 0, stepScale / this.imgH);
      gl.bindTexture(gl.TEXTURE_2D, hTmpTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    runBlur(activeImageTex, this.smallBlurHFBO, this.smallBlurFBO, this.smallBlurTmpTex, 2.0);
    runBlur(activeImageTex, this.largeBlurHFBO, this.largeBlurFBO, this.largeBlurTmpTex, 18.0);

    // Main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.mainProg);
    const u = (n: string) => gl.getUniformLocation(this.mainProg, n);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, activeImageTex);
    gl.uniform1i(u('u_image'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.smallBlurTex);
    gl.uniform1i(u('u_smallBlur'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.largeBlurTex);
    gl.uniform1i(u('u_largeBlur'), 2);

    const crop = this.cropData;
    gl.uniform2f(u('u_cropOrigin'), crop ? crop.rect.x : 0, crop ? crop.rect.y : 0);
    gl.uniform2f(u('u_cropSize'), crop ? crop.rect.w : 1, crop ? crop.rect.h : 1);
    gl.uniform1f(
      u('u_rotation'),
      crop ? ((crop.rotationSteps * 90 + crop.rotation) * Math.PI) / 180 : 0,
    );
    gl.uniform1f(u('u_flipH'), crop?.flipH ? 1 : 0);
    gl.uniform1f(u('u_flipV'), crop?.flipV ? 1 : 0);
    gl.uniform1f(u('u_imgAspect'), this.imgW / this.imgH);

    gl.uniform1f(u('u_temp'), adjustments.temp);
    gl.uniform1f(u('u_tint'), adjustments.tint);
    gl.uniform1f(u('u_exposure'), adjustments.exposure);
    gl.uniform1f(u('u_contrast'), adjustments.contrast);
    gl.uniform1f(u('u_highlights'), adjustments.highlights);
    gl.uniform1f(u('u_shadows'), adjustments.shadows);
    gl.uniform1f(u('u_whites'), adjustments.whites);
    gl.uniform1f(u('u_blacks'), adjustments.blacks);
    gl.uniform1f(u('u_texture'), adjustments.texture);
    gl.uniform1f(u('u_clarity'), adjustments.clarity);
    gl.uniform1f(u('u_dehaze'), adjustments.dehaze);
    gl.uniform1f(u('u_vibrance'), adjustments.vibrance);
    gl.uniform1f(u('u_saturation'), adjustments.saturation);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /** Read RGBA pixels from the display canvas after render (for histogram). */
  readCurrentPixels(): { data: Uint8ClampedArray; width: number; height: number } | null {
    if (!this.ready) return null;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width,
      h = canvas.height;
    const data = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { data, width: w, height: h };
  }

  dispose(): void {
    this.ready = false;
  }

  static exportDataUrl(
    image: HTMLImageElement | HTMLCanvasElement,
    adjustments: Adjustments,
    mimeType: string,
    quality: number,
    targetW?: number,
    targetH?: number,
    spots?: SpotGPUData[],
    crop?: CropState | null,
  ): string {
    const srcW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const cropW = crop ? Math.round(srcW * crop.rect.w) : srcW;
    const cropH = crop ? Math.round(srcH * crop.rect.h) : srcH;
    const stepsOdd = crop ? Math.abs(crop.rotationSteps % 2) === 1 : false;
    const outW = targetW ?? (stepsOdd ? cropH : cropW);
    const outH = targetH ?? (stepsOdd ? cropW : cropH);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const renderer = new WebGLRenderer();
    renderer.init(canvas, { preserveDrawingBuffer: true });
    renderer.loadImage(image);
    if (spots?.length) renderer.setHealSpots(spots);
    if (crop) renderer.setCropState(crop);
    renderer.render(canvas, adjustments);
    const dataUrl = canvas.toDataURL(mimeType, quality);
    renderer.dispose();
    return dataUrl;
  }
}
