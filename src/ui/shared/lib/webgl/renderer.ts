import type { Adjustments } from '@/features/develop/edit/store/adjustments-store';
import type { CropState } from '@/features/develop/crop/store/types';
import type { Mask } from '@/features/develop/mask/store/types';
import type { SpotGPUData, MaskGPUData } from './types';
import { linkProgram, createTextureF16, createFBO } from './gl-utils';
import {
  VERT_SRC,
  BLUR_FRAG_SRC,
  HEAL_FRAG_SRC,
  LINEARIZE_FRAG_SRC,
  MAIN_FRAG_SRC,
  BRUSH_VERT_SRC,
  BRUSH_FRAG_SRC,
} from './shaders';

const MAX_MASKS = 4;

/** sRGB → linear (IEC 61966-2-1 piecewise transfer) */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export class WebGLRenderer {
  private gl!: WebGL2RenderingContext;
  private blurProg!: WebGLProgram;
  private linearizeProg!: WebGLProgram;
  private mainProg!: WebGLProgram;
  private healProg!: WebGLProgram;
  private brushProg!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;

  private imageTex!: WebGLTexture; // RGBA8 sRGB (from DOM upload)
  private linearTex!: WebGLTexture; // RGBA16F linear (after linearize pass)
  private smallBlurTex!: WebGLTexture; // RGBA16F linear
  private smallBlurTmpTex!: WebGLTexture; // RGBA16F linear
  private largeBlurTex!: WebGLTexture; // RGBA16F linear
  private largeBlurTmpTex!: WebGLTexture; // RGBA16F linear
  private healTex!: WebGLTexture; // RGBA16F linear
  private toneCurveLUTTex!: WebGLTexture;

  private linearFBO!: WebGLFramebuffer;
  private smallBlurHFBO!: WebGLFramebuffer;
  private smallBlurFBO!: WebGLFramebuffer;
  private largeBlurHFBO!: WebGLFramebuffer;
  private largeBlurFBO!: WebGLFramebuffer;
  private healFBO!: WebGLFramebuffer;

  private imgW = 0;
  private imgH = 0;
  private ready = false;
  private spotsData: SpotGPUData[] = [];
  // private maskData: MaskGPUData[] = [];
  private cropData: CropState | null = null;
  private paintFBOs: (WebGLFramebuffer | null)[] = [null, null, null, null];
  private paintTextures: (WebGLTexture | null)[] = [null, null, null, null];
  private eraseFBOs: (WebGLFramebuffer | null)[] = [null, null, null, null];
  private eraseTextures: (WebGLTexture | null)[] = [null, null, null, null];
  private maskW = 0;
  private maskH = 0;
  private maxPointSize = 1024;
  private fallbackTex!: WebGLTexture; // 1×1 transparent, used for unused brush slots

  init(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}): void {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Enable float FBO rendering (required for RGBA16F render targets)
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float not supported — required for linear pipeline');
    }

    this.blurProg = linkProgram(gl, VERT_SRC, BLUR_FRAG_SRC);
    this.linearizeProg = linkProgram(gl, VERT_SRC, LINEARIZE_FRAG_SRC);
    this.mainProg = linkProgram(gl, VERT_SRC, MAIN_FRAG_SRC);
    this.healProg = linkProgram(gl, VERT_SRC, HEAL_FRAG_SRC);
    this.brushProg = linkProgram(gl, BRUSH_VERT_SRC, BRUSH_FRAG_SRC);
    this.maxPointSize = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1];

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const prog of [this.blurProg, this.linearizeProg, this.mainProg, this.healProg]) {
      const aPos = gl.getAttribLocation(prog, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    this.vao = vao;

    // Create identity LUT texture (256x1 RGBA)
    const identity = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      identity[i * 4 + 0] = i; // R
      identity[i * 4 + 1] = i; // G
      identity[i * 4 + 2] = i; // B
      identity[i * 4 + 3] = 255;
    }
    this.toneCurveLUTTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.toneCurveLUTTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, identity);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Initialize color mixer uniforms to zero
    gl.useProgram(this.mainProg);
    const zeroArr = new Float32Array(8);
    gl.uniform1fv(gl.getUniformLocation(this.mainProg, 'u_cmHue'), zeroArr);
    gl.uniform1fv(gl.getUniformLocation(this.mainProg, 'u_cmSat'), zeroArr);
    gl.uniform1fv(gl.getUniformLocation(this.mainProg, 'u_cmLum'), zeroArr);
    gl.uniform3f(gl.getUniformLocation(this.mainProg, 'u_cgShadows'), 0, 0, 0);
    gl.uniform3f(gl.getUniformLocation(this.mainProg, 'u_cgMidtones'), 0, 0, 0);
    gl.uniform3f(gl.getUniformLocation(this.mainProg, 'u_cgHighlights'), 0, 0, 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_cgBlending'), 0.5);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_cgBalance'), 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_vigAmount'), 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_vigMidpoint'), 0.5);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_vigRoundness'), 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_vigFeather'), 0.5);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_vigHighlights'), 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_grainAmount'), 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_grainSize'), 0.25);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'u_grainRoughness'), 0.5);

    // Mask uniforms init
    gl.uniform1i(gl.getUniformLocation(this.mainProg, 'u_maskCount'), 0);
    gl.uniform1iv(gl.getUniformLocation(this.mainProg, 'u_maskType'), new Int32Array(MAX_MASKS));
    // Bind paint brush texture samplers to TEXTURE4-7
    for (let i = 0; i < MAX_MASKS; i++) {
      gl.uniform1i(gl.getUniformLocation(this.mainProg, `u_maskTex${i}`), 4 + i);
    }
    // Bind erase brush texture samplers to TEXTURE8-11
    for (let i = 0; i < MAX_MASKS; i++) {
      gl.uniform1i(gl.getUniformLocation(this.mainProg, `u_maskEraseTex${i}`), 8 + i);
    }
    gl.useProgram(null);

    // Fallback 1×1 zero texture for unused brush mask slots
    this.fallbackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.fallbackTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
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

    // RGBA16F linear textures for the HDR pipeline
    this.linearTex = createTextureF16(gl, w, h);
    this.linearFBO = createFBO(gl, this.linearTex);
    this.smallBlurTmpTex = createTextureF16(gl, w, h);
    this.smallBlurTex = createTextureF16(gl, w, h);
    this.largeBlurTmpTex = createTextureF16(gl, w, h);
    this.largeBlurTex = createTextureF16(gl, w, h);
    this.smallBlurHFBO = createFBO(gl, this.smallBlurTmpTex);
    this.smallBlurFBO = createFBO(gl, this.smallBlurTex);
    this.largeBlurHFBO = createFBO(gl, this.largeBlurTmpTex);
    this.largeBlurFBO = createFBO(gl, this.largeBlurTex);
    this.healTex = createTextureF16(gl, w, h);
    this.healFBO = createFBO(gl, this.healTex);

    // Compute mask FBO dims (max 2048 on larger side)
    const MAX_BRUSH_DIM = 2048;
    const mScale = Math.min(1, MAX_BRUSH_DIM / Math.max(this.imgW, this.imgH));
    this.maskW = Math.max(1, Math.round(this.imgW * mScale));
    this.maskH = Math.max(1, Math.round(this.imgH * mScale));

    // Create/recreate paint and erase FBOs for each mask slot
    for (let i = 0; i < MAX_MASKS; i++) {
      if (this.paintTextures[i]) {
        gl.deleteTexture(this.paintTextures[i]);
        this.paintTextures[i] = null;
      }
      if (this.paintFBOs[i]) {
        gl.deleteFramebuffer(this.paintFBOs[i]);
        this.paintFBOs[i] = null;
      }
      if (this.eraseTextures[i]) {
        gl.deleteTexture(this.eraseTextures[i]);
        this.eraseTextures[i] = null;
      }
      if (this.eraseFBOs[i]) {
        gl.deleteFramebuffer(this.eraseFBOs[i]);
        this.eraseFBOs[i] = null;
      }

      // Create paint FBO
      this.paintTextures[i] = this.createBrushTex(this.maskW, this.maskH);
      this.paintFBOs[i] = createFBO(gl, this.paintTextures[i]!);
      // Create erase FBO
      this.eraseTextures[i] = this.createBrushTex(this.maskW, this.maskH);
      this.eraseFBOs[i] = createFBO(gl, this.eraseTextures[i]!);
      // Clear both
      this.clearBrushFBO(this.paintFBOs[i]!);
      this.clearBrushFBO(this.eraseFBOs[i]!);
    }

    this.ready = true;
  }

  setHealSpots(spots: SpotGPUData[]): void {
    this.spotsData = spots.slice(0, 32);
  }

  setMasks(masks: MaskGPUData[]): void {
    const gl = this.gl;
    if (!gl) return;
    const count = Math.min(masks.length, MAX_MASKS);
    // this.maskData = masks.slice(0, MAX_MASKS);

    // Brush textures are managed via GPU FBOs (see addBrushStrokes / clearBrushMask)

    // Upload uniforms
    gl.useProgram(this.mainProg);
    const u = (n: string) => gl.getUniformLocation(this.mainProg, n);
    gl.uniform1i(u('u_maskCount'), count);

    const types = new Int32Array(MAX_MASKS);
    // TODO: use zeroF to reset unused mask uniform arrays (fix GPU bleeding)
    const exp_ = new Float32Array(MAX_MASKS),
      con_ = new Float32Array(MAX_MASKS);
    const high_ = new Float32Array(MAX_MASKS),
      shad_ = new Float32Array(MAX_MASKS);
    const whites_ = new Float32Array(MAX_MASKS),
      blacks_ = new Float32Array(MAX_MASKS);
    const temp_ = new Float32Array(MAX_MASKS),
      tint_ = new Float32Array(MAX_MASKS);
    const texv_ = new Float32Array(MAX_MASKS),
      clar_ = new Float32Array(MAX_MASKS);
    const dehaze_ = new Float32Array(MAX_MASKS),
      vib_ = new Float32Array(MAX_MASKS);
    const sat_ = new Float32Array(MAX_MASKS);
    const linear_ = new Float32Array(MAX_MASKS * 4);
    const linearF_ = new Float32Array(MAX_MASKS);
    const radial_ = new Float32Array(MAX_MASKS * 4);
    const radialP_ = new Float32Array(MAX_MASKS * 3);

    for (let i = 0; i < MAX_MASKS; i++) {
      const m = masks[i];
      if (!m) continue;
      types[i] = m.type;
      exp_[i] = m.adj.exposure;
      con_[i] = m.adj.contrast;
      high_[i] = m.adj.highlights;
      shad_[i] = m.adj.shadows;
      whites_[i] = m.adj.whites;
      blacks_[i] = m.adj.blacks;
      temp_[i] = m.adj.temp;
      tint_[i] = m.adj.tint;
      texv_[i] = m.adj.texture;
      clar_[i] = m.adj.clarity;
      dehaze_[i] = m.adj.dehaze;
      vib_[i] = m.adj.vibrance;
      sat_[i] = m.adj.saturation;
      if (m.linear) {
        linear_.set(m.linear.slice(0, 4), i * 4);
        linearF_[i] = m.linear[4];
      }
      if (m.radial) {
        radial_.set(m.radial.slice(0, 4), i * 4);
        radialP_.set(m.radial.slice(4, 7), i * 3);
      }
    }

    gl.uniform1iv(u('u_maskType'), types);
    gl.uniform1fv(u('u_maskExp'), exp_);
    gl.uniform1fv(u('u_maskCon'), con_);
    gl.uniform1fv(u('u_maskHigh'), high_);
    gl.uniform1fv(u('u_maskShad'), shad_);
    gl.uniform1fv(u('u_maskWhites'), whites_);
    gl.uniform1fv(u('u_maskBlacks'), blacks_);
    gl.uniform1fv(u('u_maskTemp'), temp_);
    gl.uniform1fv(u('u_maskTint_'), tint_);
    gl.uniform1fv(u('u_maskTexVal'), texv_);
    gl.uniform1fv(u('u_maskClar'), clar_);
    gl.uniform1fv(u('u_maskDehaze'), dehaze_);
    gl.uniform1fv(u('u_maskVib'), vib_);
    gl.uniform1fv(u('u_maskSat'), sat_);
    gl.uniform4fv(u('u_maskLinear'), linear_);
    gl.uniform1fv(u('u_maskLinearFeather'), linearF_);
    gl.uniform4fv(u('u_maskRadial'), radial_);
    gl.uniform3fv(u('u_maskRadialParams'), radialP_);
    // unused arrays still need a value to avoid GLSL undefined
    gl.uniform1fv(u('u_maskExp'), exp_);
    gl.useProgram(null);
  }
  setCropState(crop: CropState | null): void {
    this.cropData = crop;
  }
  get isReady() {
    return this.ready;
  }
  get imageWidth() {
    return this.imgW;
  }
  get imageHeight() {
    return this.imgH;
  }

  setToneCurveLUT(rData: Uint8Array, gData: Uint8Array, bData: Uint8Array): void {
    const gl = this.gl;
    if (!gl || !this.toneCurveLUTTex) return;
    const rgba = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      rgba[i * 4 + 0] = rData[i];
      rgba[i * 4 + 1] = gData[i];
      rgba[i * 4 + 2] = bData[i];
      rgba[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.toneCurveLUTTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setColorMixer(hue: number[], sat: number[], lum: number[]): void {
    const gl = this.gl;
    if (!gl) return;
    gl.useProgram(this.mainProg);
    gl.uniform1fv(
      gl.getUniformLocation(this.mainProg, 'u_cmHue'),
      new Float32Array(hue.map((v) => v / 180)),
    );
    gl.uniform1fv(
      gl.getUniformLocation(this.mainProg, 'u_cmSat'),
      new Float32Array(sat.map((v) => v / 100)),
    );
    gl.uniform1fv(
      gl.getUniformLocation(this.mainProg, 'u_cmLum'),
      new Float32Array(lum.map((v) => v / 100)),
    );
    gl.useProgram(null);
  }

  setColorGrading(
    shadows: [number, number, number],
    midtones: [number, number, number],
    highlights: [number, number, number],
    blending: number,
    balance: number,
  ): void {
    const gl = this.gl;
    if (!gl) return;
    gl.useProgram(this.mainProg);
    const u = (n: string) => gl.getUniformLocation(this.mainProg, n);
    gl.uniform3f(u('u_cgShadows'), ...shadows);
    gl.uniform3f(u('u_cgMidtones'), ...midtones);
    gl.uniform3f(u('u_cgHighlights'), ...highlights);
    gl.uniform1f(u('u_cgBlending'), blending);
    gl.uniform1f(u('u_cgBalance'), balance);
    gl.useProgram(null);
  }

  setEffects(
    vigAmount: number,
    vigMidpoint: number,
    vigRoundness: number,
    vigFeather: number,
    vigHighlights: number,
    grainAmount: number,
    grainSize: number,
    grainRoughness: number,
  ): void {
    const gl = this.gl;
    if (!gl) return;
    gl.useProgram(this.mainProg);
    const u = (n: string) => gl.getUniformLocation(this.mainProg, n);
    gl.uniform1f(u('u_vigAmount'), vigAmount);
    gl.uniform1f(u('u_vigMidpoint'), vigMidpoint);
    gl.uniform1f(u('u_vigRoundness'), vigRoundness);
    gl.uniform1f(u('u_vigFeather'), vigFeather);
    gl.uniform1f(u('u_vigHighlights'), vigHighlights);
    gl.uniform1f(u('u_grainAmount'), grainAmount);
    gl.uniform1f(u('u_grainSize'), grainSize);
    gl.uniform1f(u('u_grainRoughness'), grainRoughness);
    gl.useProgram(null);
  }

  private createBrushTex(w: number, h: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Use RGBA8 — guaranteed color-renderable in WebGL2 (R8 FBO may not clear correctly on some drivers)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Use LINEAR for smooth mask edges; feather in the brush shader controls softness
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private clearBrushFBO(fbo: WebGLFramebuffer): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, this.maskW, this.maskH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  addBrushStrokes(
    slot: number,
    strokes: import('@/features/develop/mask').BrushStroke[],
    erase: boolean,
  ): void {
    const gl = this.gl;
    if (!this.ready || slot < 0 || slot >= MAX_MASKS || this.maskW === 0) return;
    const fbo = erase ? this.eraseFBOs[slot] : this.paintFBOs[slot];
    if (!fbo) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, this.maskW, this.maskH);
    gl.bindVertexArray(null); // brush shader uses no vertex attributes
    gl.useProgram(this.brushProg);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);

    const uCenter = gl.getUniformLocation(this.brushProg, 'u_brCenter');
    const uRadiusPx = gl.getUniformLocation(this.brushProg, 'u_brRadiusPx');
    const uFeather = gl.getUniformLocation(this.brushProg, 'u_brFeather');
    const uOpacity = gl.getUniformLocation(this.brushProg, 'u_brOpacity');

    for (const stroke of strokes) {
      const radiusPx = Math.min((stroke.size / 2) * this.maskW, this.maxPointSize / 2);
      gl.uniform1f(uRadiusPx, radiusPx);
      gl.uniform1f(uFeather, stroke.feather);
      gl.uniform1f(uOpacity, stroke.opacity);

      const { points } = stroke;
      if (points.length === 0) continue;

      // Draw first point
      gl.uniform2f(uCenter, points[0].x, points[0].y);
      gl.drawArrays(gl.POINTS, 0, 1);

      for (let i = 1; i < points.length; i++) {
        // Interpolate between previous and current point
        const prev = points[i - 1];
        const cur = points[i];
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const distUV = Math.hypot(dx, dy);
        const stepUV = stroke.size * 0.2; // step = 20% of radius
        const steps = Math.max(1, Math.floor(distUV / stepUV));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          gl.uniform2f(uCenter, prev.x + dx * t, prev.y + dy * t);
          gl.drawArrays(gl.POINTS, 0, 1);
        }
      }
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  clearBrushMask(slot: number): void {
    if (!this.ready || slot < 0 || slot >= MAX_MASKS || this.maskW === 0) return;
    if (this.paintFBOs[slot]) this.clearBrushFBO(this.paintFBOs[slot]!);
    if (this.eraseFBOs[slot]) this.clearBrushFBO(this.eraseFBOs[slot]!);
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
    gl.bindTexture(gl.TEXTURE_2D, this.linearTex);
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
      // colorData handling depends on mode:
      // - fill (mode=2): absolute sRGB color → linearize
      // - heal (mode=0): sRGB difference (dst-src border means) → linearize each
      //   mean separately then take the difference
      // - clone (mode=1): always [0,0,0] → no conversion needed
      if (s.mode === 2) {
        // Fill: absolute color, linearize directly
        color[b] = srgbToLinear(s.colorData[0]);
        color[b + 1] = srgbToLinear(s.colorData[1]);
        color[b + 2] = srgbToLinear(s.colorData[2]);
      } else {
        // Heal/clone: pass through (heal offset is applied additively in shader)
        // For heal mode, the offset was computed in sRGB space. Since we now work
        // in linear space, we approximate by scaling the offset by ~2.2 (average
        // gamma) to account for the expanded linear range in midtones.
        const scale = s.mode === 0 ? 2.2 : 1.0;
        color[b] = s.colorData[0] * scale;
        color[b + 1] = s.colorData[1] * scale;
        color[b + 2] = s.colorData[2] * scale;
      }
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

    gl.bindVertexArray(this.vao);

    // ── Linearize pass: sRGB (RGBA8) → linear (RGBA16F) ─────────────
    gl.useProgram(this.linearizeProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.linearFBO);
    gl.viewport(0, 0, this.imgW, this.imgH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(gl.getUniformLocation(this.linearizeProg, 'u_src'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // From here on, everything uses linearTex (or healTex) as the source
    const activeImageTex = this.runHealPass() ?? this.linearTex;

    // Re-bind VAO (heal pass unbinds it)
    gl.bindVertexArray(this.vao);

    // Blur passes (operate on linear data)
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
    runBlur(activeImageTex, this.largeBlurHFBO, this.largeBlurFBO, this.largeBlurTmpTex, 28.0);

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

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.toneCurveLUTTex);
    gl.uniform1i(u('u_toneCurveLUT'), 3);

    // Bind paint mask textures to TEXTURE4-7
    for (let i = 0; i < MAX_MASKS; i++) {
      gl.activeTexture(gl.TEXTURE4 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.paintTextures[i] ?? this.fallbackTex);
    }
    // Bind erase mask textures to TEXTURE8-11
    for (let i = 0; i < MAX_MASKS; i++) {
      gl.activeTexture(gl.TEXTURE8 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.eraseTextures[i] ?? this.fallbackTex);
    }

    const crop = this.cropData;
    // Crop overlay uses screen coords (Y-down: y=0 is top), but texture coords
    // are Y-up (UNPACK_FLIP_Y_WEBGL makes texCoord y=0 = bottom of image).
    // Flip Y: shader_y = 1 - overlay_y - overlay_h
    gl.uniform2f(
      u('u_cropOrigin'),
      crop ? crop.rect.x : 0,
      crop ? 1 - crop.rect.y - crop.rect.h : 0,
    );
    gl.uniform2f(u('u_cropSize'), crop ? crop.rect.w : 1, crop ? crop.rect.h : 1);
    // Fine rotation (straighten) only — 90° steps handled separately
    gl.uniform1f(u('u_rotation'), crop ? (-crop.rotation * Math.PI) / 180 : 0);
    // 90° rotation steps as UV swaps (normalized to 0-3)
    const rotSteps = crop ? ((crop.rotationSteps % 4) + 4) % 4 : 0;
    gl.uniform1i(u('u_rotSteps'), rotSteps);
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
    opts: {
      targetW?: number;
      targetH?: number;
      spots?: SpotGPUData[];
      crop?: CropState | null;
      toneCurve?: { r: Uint8Array; g: Uint8Array; b: Uint8Array };
      colorMixer?: { hue: number[]; sat: number[]; lum: number[] };
      colorGrading?: {
        shadows: [number, number, number];
        midtones: [number, number, number];
        highlights: [number, number, number];
        blending: number;
        balance: number;
      };
      effects?: {
        vigAmount: number;
        vigMidpoint: number;
        vigRoundness: number;
        vigFeather: number;
        vigHighlights: number;
        grainAmount: number;
        grainSize: number;
        grainRoughness: number;
      };
      masks?: Mask[];
    } = {},
  ): string {
    const { targetW, targetH, spots, crop, toneCurve, colorMixer, colorGrading, effects, masks } =
      opts;
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

    // Masks
    const activeMasks = (masks ?? []).filter((m) => m.enabled).slice(0, 4);
    const gpuMasks: MaskGPUData[] = activeMasks.map((m): MaskGPUData => {
      const adj = m.adjustments;
      const base = {
        adj: {
          exposure: adj.exposure,
          contrast: adj.contrast,
          highlights: adj.highlights,
          shadows: adj.shadows,
          whites: adj.whites,
          blacks: adj.blacks,
          temp: adj.temp,
          tint: adj.tint,
          texture: adj.texture,
          clarity: adj.clarity,
          dehaze: adj.dehaze,
          vibrance: adj.vibrance,
          saturation: adj.saturation,
        },
      };
      if (m.mask.type === 'brush') return { type: 1, ...base };
      if (m.mask.type === 'linear') {
        const d = m.mask.data;
        return { type: 2, linear: [d.x1, d.y1, d.x2, d.y2, d.feather], ...base };
      }
      const d = m.mask.data;
      return {
        type: 3,
        radial: [d.cx, d.cy, d.rx, d.ry, d.angle, d.feather, d.invert ? 1 : 0],
        ...base,
      };
    });
    renderer.setMasks(gpuMasks);

    // Brush mask strokes
    activeMasks.forEach((m, slot) => {
      if (m.mask.type !== 'brush') return;
      const paintStrokes = m.mask.strokes.filter((s) => !s.erase);
      const eraseStrokes = m.mask.strokes.filter((s) => s.erase);
      if (paintStrokes.length > 0) renderer.addBrushStrokes(slot, paintStrokes, false);
      if (eraseStrokes.length > 0) renderer.addBrushStrokes(slot, eraseStrokes, true);
    });

    if (spots?.length) renderer.setHealSpots(spots);
    if (crop) renderer.setCropState(crop);
    if (toneCurve) renderer.setToneCurveLUT(toneCurve.r, toneCurve.g, toneCurve.b);
    if (colorMixer) renderer.setColorMixer(colorMixer.hue, colorMixer.sat, colorMixer.lum);
    if (colorGrading) {
      renderer.setColorGrading(
        colorGrading.shadows,
        colorGrading.midtones,
        colorGrading.highlights,
        colorGrading.blending,
        colorGrading.balance,
      );
    }
    if (effects) {
      renderer.setEffects(
        effects.vigAmount,
        effects.vigMidpoint,
        effects.vigRoundness,
        effects.vigFeather,
        effects.vigHighlights,
        effects.grainAmount,
        effects.grainSize,
        effects.grainRoughness,
      );
    }
    renderer.render(canvas, adjustments);
    const dataUrl = canvas.toDataURL(mimeType, quality);
    renderer.dispose();
    return dataUrl;
  }
}
