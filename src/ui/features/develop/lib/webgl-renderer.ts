import type { Adjustments } from '../model/adjustments-store';

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  v_texCoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const BLUR_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_step;
in vec2 v_texCoord;
out vec4 fragColor;

// 13-tap Gaussian kernel (sigma ≈ 3)
const float W[7] = float[7](0.00598, 0.060626, 0.241843, 0.383103, 0.241843, 0.060626, 0.00598);

void main() {
  vec3 result = vec3(0.0);
  float total = 0.0;
  for (int i = -3; i <= 3; i++) {
    float w = W[i + 3];
    result += texture(u_src, v_texCoord + float(i) * u_step).rgb * w;
    total += w;
  }
  fragColor = vec4(result / total, 1.0);
}`;

const MAIN_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_smallBlur;
uniform sampler2D u_largeBlur;

uniform float u_temp;
uniform float u_tint;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_texture;
uniform float u_clarity;
uniform float u_dehaze;
uniform float u_vibrance;
uniform float u_saturation;

in vec2 v_texCoord;
out vec4 fragColor;

const float PI = 3.14159265;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float s = 0.0;
  float h = 0.0;
  if (maxC != minC) {
    float d = maxC - minC;
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r)      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else                  h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5)     return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s == 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
}

void main() {
  vec2 uv = v_texCoord;
  vec3 color = texture(u_image, uv).rgb;

  // ── WHITE BALANCE ────────────────────────────────────────────────────
  float t = u_temp / 100.0;
  color.r += t * 0.12;
  color.g += t * 0.02;
  color.b -= t * 0.12;
  float tint = u_tint / 100.0;
  color.r += tint * 0.04;
  color.g -= tint * 0.08;
  color.b += tint * 0.04;

  // ── EXPOSURE ──────────────────────────────────────────────────────────
  color *= pow(2.0, u_exposure);

  // ── TONE ─────────────────────────────────────────────────────────────
  float lum = luma(color);

  // Blacks (0–0.35 zone)
  if (abs(u_blacks) > 0.5) {
    float mask = pow(clamp(1.0 - lum / 0.35, 0.0, 1.0), 1.5);
    float adj = (u_blacks / 100.0) * mask;
    color = u_blacks > 0.0
      ? color + adj * (1.0 - color) * 0.5
      : color * (1.0 + adj * 0.8);
    lum = luma(color);
  }

  // Shadows (0–0.55 zone)
  if (abs(u_shadows) > 0.5) {
    float mask = pow(clamp(1.0 - lum / 0.55, 0.0, 1.0), 1.2);
    float adj = (u_shadows / 100.0) * mask * 0.45;
    color += adj * (1.0 + color * 0.2);
    lum = luma(color);
  }

  // Highlights (0.45–1.0 zone)
  if (abs(u_highlights) > 0.5) {
    float mask = pow(clamp((lum - 0.45) / 0.55, 0.0, 1.0), 1.2);
    float adj = (u_highlights / 100.0) * mask * 0.45;
    color += adj * color;
    lum = luma(color);
  }

  // Whites (0.65–1.0 zone)
  if (abs(u_whites) > 0.5) {
    float mask = pow(clamp((lum - 0.65) / 0.35, 0.0, 1.0), 1.5);
    float adj = (u_whites / 100.0) * mask;
    color = u_whites > 0.0
      ? color + adj * (1.0 - color) * 0.5
      : color * (1.0 + adj * 0.4);
  }

  // ── CONTRAST ─────────────────────────────────────────────────────────
  // Lightroom S-curve: tan(PI/4 * (1 + c/2)) pivoted at 0.5
  if (abs(u_contrast) > 0.5) {
    float c = u_contrast / 100.0;
    float factor = tan(PI * 0.25 * (1.0 + c * 0.5));
    color = (color - 0.5) * factor + 0.5;
  }

  // ── CLARITY (midtone local contrast, large blur) ──────────────────────
  if (abs(u_clarity) > 0.5) {
    vec3 lb = texture(u_largeBlur, uv).rgb;
    lum = luma(color);
    // Bell mask: strongest at midtones (lum ≈ 0.5)
    float mask = 1.0 - abs(lum * 2.0 - 1.0);
    mask = mask * mask;
    color += (color - lb) * (u_clarity / 100.0) * mask * 1.8;
  }

  // ── TEXTURE (fine detail, small blur) ─────────────────────────────────
  if (abs(u_texture) > 0.5) {
    vec3 sb = texture(u_smallBlur, uv).rgb;
    color += (color - sb) * (u_texture / 100.0) * 0.9;
  }

  // ── DEHAZE (simplified: local contrast + desaturation of haze) ────────
  if (abs(u_dehaze) > 0.5) {
    vec3 lb = texture(u_largeBlur, uv).rgb;
    float d = u_dehaze / 100.0;
    color -= d * 0.04;
    color += (color - lb) * d * 0.6;
  }

  // ── SATURATION ────────────────────────────────────────────────────────
  if (abs(u_saturation) > 0.5) {
    float grey = luma(color);
    color = mix(vec3(grey), color, 1.0 + u_saturation / 100.0);
  }

  // ── VIBRANCE (smart saturation) ───────────────────────────────────────
  if (abs(u_vibrance) > 0.5) {
    vec3 hsl = rgb2hsl(color);
    float protect = 1.0 - hsl.y;
    hsl.y = clamp(hsl.y + (u_vibrance / 100.0) * protect * 0.65, 0.0, 1.0);
    color = hsl2rgb(hsl);
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function createTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

// ─── main class ───────────────────────────────────────────────────────────────

export class WebGLRenderer {
  private gl!: WebGL2RenderingContext;
  private blurProg!: WebGLProgram;
  private mainProg!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;

  // textures
  private imageTex!: WebGLTexture;
  private smallBlurTex!: WebGLTexture;
  private smallBlurTmpTex!: WebGLTexture;
  private largeBlurTex!: WebGLTexture;
  private largeBlurTmpTex!: WebGLTexture;

  // fbos
  private smallBlurHFBO!: WebGLFramebuffer;
  private smallBlurFBO!: WebGLFramebuffer;
  private largeBlurHFBO!: WebGLFramebuffer;
  private largeBlurFBO!: WebGLFramebuffer;

  private imgW = 0;
  private imgH = 0;
  private ready = false;

  init(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}): void {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.blurProg = linkProgram(gl, VERT_SRC, BLUR_FRAG_SRC);
    this.mainProg = linkProgram(gl, VERT_SRC, MAIN_FRAG_SRC);

    // Full-screen quad
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.blurProg, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    // bind same attrib for main program too
    const aPos2 = gl.getAttribLocation(this.mainProg, 'a_position');
    gl.enableVertexAttribArray(aPos2);
    gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
  }

  loadImage(image: HTMLImageElement): void {
    const gl = this.gl;
    this.imgW = image.naturalWidth;
    this.imgH = image.naturalHeight;
    const w = this.imgW;
    const h = this.imgH;

    // Upload image texture
    if (!this.imageTex) {
      this.imageTex = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Allocate / re-allocate intermediate textures
    this.smallBlurTmpTex = createTexture(gl, w, h);
    this.smallBlurTex    = createTexture(gl, w, h);
    this.largeBlurTmpTex = createTexture(gl, w, h);
    this.largeBlurTex    = createTexture(gl, w, h);

    this.smallBlurHFBO = createFBO(gl, this.smallBlurTmpTex);
    this.smallBlurFBO  = createFBO(gl, this.smallBlurTex);
    this.largeBlurHFBO = createFBO(gl, this.largeBlurTmpTex);
    this.largeBlurFBO  = createFBO(gl, this.largeBlurTex);

    this.ready = true;
  }

  render(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
    if (!this.ready) return;
    const gl = this.gl;
    const w = this.imgW;
    const h = this.imgH;

    gl.bindVertexArray(this.vao);

    // ── blur passes ──────────────────────────────────────────────────────
    gl.useProgram(this.blurProg);
    const uStep = gl.getUniformLocation(this.blurProg, 'u_step');
    const uSrc  = gl.getUniformLocation(this.blurProg, 'u_src');

    const runBlur = (
      srcTex: WebGLTexture,
      hFBO: WebGLFramebuffer,
      vFBO: WebGLFramebuffer,
      hTmpTex: WebGLTexture,
      stepScale: number,
    ) => {
      gl.viewport(0, 0, w, h);
      // Horizontal
      gl.bindFramebuffer(gl.FRAMEBUFFER, hFBO);
      gl.uniform2f(uStep, stepScale / w, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(uSrc, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Vertical
      gl.bindFramebuffer(gl.FRAMEBUFFER, vFBO);
      gl.uniform2f(uStep, 0, stepScale / h);
      gl.bindTexture(gl.TEXTURE_2D, hTmpTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Small blur: step=2 px (texture detail)
    runBlur(this.imageTex, this.smallBlurHFBO, this.smallBlurFBO, this.smallBlurTmpTex, 2.0);
    // Large blur: step=18 px (clarity)
    runBlur(this.imageTex, this.largeBlurHFBO, this.largeBlurFBO, this.largeBlurTmpTex, 18.0);

    // ── main pass ────────────────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.mainProg);

    const u = (name: string) => gl.getUniformLocation(this.mainProg, name);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(u('u_image'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.smallBlurTex);
    gl.uniform1i(u('u_smallBlur'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.largeBlurTex);
    gl.uniform1i(u('u_largeBlur'), 2);

    gl.uniform1f(u('u_temp'),        adjustments.temp);
    gl.uniform1f(u('u_tint'),        adjustments.tint);
    gl.uniform1f(u('u_exposure'),    adjustments.exposure);
    gl.uniform1f(u('u_contrast'),    adjustments.contrast);
    gl.uniform1f(u('u_highlights'),  adjustments.highlights);
    gl.uniform1f(u('u_shadows'),     adjustments.shadows);
    gl.uniform1f(u('u_whites'),      adjustments.whites);
    gl.uniform1f(u('u_blacks'),      adjustments.blacks);
    gl.uniform1f(u('u_texture'),     adjustments.texture);
    gl.uniform1f(u('u_clarity'),     adjustments.clarity);
    gl.uniform1f(u('u_dehaze'),      adjustments.dehaze);
    gl.uniform1f(u('u_vibrance'),    adjustments.vibrance);
    gl.uniform1f(u('u_saturation'),  adjustments.saturation);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  get isReady() { return this.ready; }

  dispose(): void {
    this.ready = false;
  }

  /**
   * Renders the image at full original resolution on a temporary offscreen
   * canvas and returns a data URL. Safe to call from any context.
   */
  static exportDataUrl(
    image: HTMLImageElement,
    adjustments: Adjustments,
    mimeType: string,
    quality: number, // 0–1
    targetW?: number,
    targetH?: number,
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width  = targetW ?? image.naturalWidth;
    canvas.height = targetH ?? image.naturalHeight;

    const renderer = new WebGLRenderer();
    renderer.init(canvas, { preserveDrawingBuffer: true });
    renderer.loadImage(image);
    renderer.render(canvas, adjustments);
    const dataUrl = canvas.toDataURL(mimeType, quality);
    renderer.dispose();
    return dataUrl;
  }
}
