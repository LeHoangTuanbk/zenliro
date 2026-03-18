import type { Adjustments } from '../model/adjustments-store';

export interface SpotGPUData {
  dst: { x: number; y: number };
  src: { x: number; y: number };
  radius: number;   // normalized (relative to imgW)
  feather: number;  // 0–1
  opacity: number;  // 0–1
  mode: 0 | 1 | 2; // 0=heal, 1=clone, 2=fill
  colorData: [number, number, number]; // 0–1 range (fill color or heal offset)
}

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  // Standard OpenGL texcoords: y=0 at bottom, y=1 at top.
  // We upload images with UNPACK_FLIP_Y so this matches image top-to-bottom.
  v_texCoord = vec2(a_position.x * 0.5 + 0.5, a_position.y * 0.5 + 0.5);
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

const HEAL_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

#define MAX_SPOTS 32

uniform sampler2D u_image;
uniform int u_spotCount;
uniform float u_hOverW;  // imgH / imgW for aspect-correct circular distance

// Per-spot data (packed as vec4 arrays)
uniform vec4 u_dstSrc[MAX_SPOTS];    // dst.xy, src.xy (normalized 0-1)
uniform vec4 u_params[MAX_SPOTS];    // radius, feather, opacity, mode(0=heal 1=clone 2=fill)
uniform vec4 u_colorData[MAX_SPOTS]; // rgb = fill color or heal color offset (0-1), w unused

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec3 color = texture(u_image, v_texCoord).rgb;

  for (int i = 0; i < MAX_SPOTS; i++) {
    if (i >= u_spotCount) break;

    vec2  dst     = u_dstSrc[i].xy;
    vec2  src     = u_dstSrc[i].zw;
    float radius  = u_params[i].x;
    float feather = u_params[i].y;
    float opacity = u_params[i].z;
    int   mode    = int(u_params[i].w + 0.5);

    // Aspect-correct distance so radius is circular in pixel space
    vec2  d    = v_texCoord - dst;
    float dist = length(vec2(d.x, d.y * u_hOverW));
    if (dist > radius) continue;

    // Feather / alpha — fill uses Gaussian for zero-boundary smoothness;
    // heal/clone use the classic smoothstep hard-radius approach.
    float alpha;
    if (mode == 2) {
      // Gaussian: exp(-k * (dist/radius)²). k=3.5 → near-zero at edge, no visible ring.
      float nd = dist / radius;
      alpha = exp(-3.5 * nd * nd) * opacity;
    } else {
      float hardR = radius * (1.0 - feather);
      float zone  = max(radius - hardR, 0.001);
      float t     = clamp((dist - hardR) / zone, 0.0, 1.0);
      alpha = (1.0 - t * t * (3.0 - 2.0 * t)) * opacity;
    }
    if (alpha <= 0.001) continue;

    vec3 srcColor;
    if (mode == 2) {
      // Fill: blend toward surrounding skin tone color.
      // Gaussian alpha provides smooth spatial falloff — no hard boundary.
      srcColor = u_colorData[i].rgb;
    } else {
      // Heal or Clone: sample source texture with same offset
      vec2 srcUV = clamp(src + d, vec2(0.0), vec2(1.0));
      srcColor = texture(u_image, srcUV).rgb;
      if (mode == 0) {
        // Heal: add pre-computed color correction (stronger at center)
        float hw = (1.0 - dist / radius) * 0.6 + 0.4;
        srcColor = clamp(srcColor + u_colorData[i].rgb * hw, 0.0, 1.0);
      }
    }

    color = mix(color, clamp(srcColor, 0.0, 1.0), alpha);
  }

  fragColor = vec4(color, 1.0);
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
  private healProg!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;

  // textures
  private imageTex!: WebGLTexture;
  private smallBlurTex!: WebGLTexture;
  private smallBlurTmpTex!: WebGLTexture;
  private largeBlurTex!: WebGLTexture;
  private largeBlurTmpTex!: WebGLTexture;
  private healTex!:  WebGLTexture;

  // fbos
  private smallBlurHFBO!: WebGLFramebuffer;
  private smallBlurFBO!: WebGLFramebuffer;
  private largeBlurHFBO!: WebGLFramebuffer;
  private largeBlurFBO!: WebGLFramebuffer;
  private healFBO!:  WebGLFramebuffer;

  private imgW = 0;
  private imgH = 0;
  private ready = false;
  private spotsData: SpotGPUData[] = [];

  init(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}): void {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.blurProg = linkProgram(gl, VERT_SRC, BLUR_FRAG_SRC);
    this.mainProg = linkProgram(gl, VERT_SRC, MAIN_FRAG_SRC);
    this.healProg = linkProgram(gl, VERT_SRC, HEAL_FRAG_SRC);

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
    // bind same attrib for heal program
    const aPos3 = gl.getAttribLocation(this.healProg, 'a_position');
    gl.enableVertexAttribArray(aPos3);
    gl.vertexAttribPointer(aPos3, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
  }

  loadImage(image: HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl;
    this.imgW = image instanceof HTMLImageElement ? image.naturalWidth  : image.width;
    this.imgH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const w = this.imgW;
    const h = this.imgH;

    // Upload image texture
    if (!this.imageTex) {
      this.imageTex = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    // Flip Y on upload so texCoord.y=1 = top of image (standard OpenGL convention).
    // This makes FBO output textures consistent with the source imageTex.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
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

    // Heal texture + FBO
    this.healTex = createTexture(gl, w, h);
    this.healFBO = createFBO(gl, this.healTex);

    this.ready = true;
  }

  setHealSpots(spots: SpotGPUData[]): void {
    this.spotsData = spots.slice(0, 32);
  }

  private runHealPass(): WebGLTexture | null {
    if (this.spotsData.length === 0) return null;

    const gl = this.gl;
    const w = this.imgW;
    const h = this.imgH;
    const MAX_SPOTS = 32;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.healFBO);
    gl.viewport(0, 0, w, h);

    gl.bindVertexArray(this.vao);
    gl.useProgram(this.healProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(gl.getUniformLocation(this.healProg, 'u_image'), 0);

    const count = this.spotsData.length;
    gl.uniform1i(gl.getUniformLocation(this.healProg, 'u_spotCount'), count);
    gl.uniform1f(gl.getUniformLocation(this.healProg, 'u_hOverW'), h / w);

    // Build flat Float32Arrays for each uniform array (MAX_SPOTS * 4 floats each)
    const dstSrcArr   = new Float32Array(MAX_SPOTS * 4);
    const paramsArr   = new Float32Array(MAX_SPOTS * 4);
    const colorArr    = new Float32Array(MAX_SPOTS * 4);

    for (let i = 0; i < count; i++) {
      const s = this.spotsData[i];
      const base = i * 4;
      // Spot coords use canvas convention (y=0=top); texcoords use y=0=bottom → flip y.
      dstSrcArr[base]     = s.dst.x;
      dstSrcArr[base + 1] = 1.0 - s.dst.y;
      dstSrcArr[base + 2] = s.src.x;
      dstSrcArr[base + 3] = 1.0 - s.src.y;

      paramsArr[base]     = s.radius;
      paramsArr[base + 1] = s.feather;
      paramsArr[base + 2] = s.opacity;
      paramsArr[base + 3] = s.mode;

      colorArr[base]     = s.colorData[0];
      colorArr[base + 1] = s.colorData[1];
      colorArr[base + 2] = s.colorData[2];
      colorArr[base + 3] = 0;
    }

    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_dstSrc'),    dstSrcArr);
    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_params'),    paramsArr);
    gl.uniform4fv(gl.getUniformLocation(this.healProg, 'u_colorData'), colorArr);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return this.healTex;
  }

  render(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
    if (!this.ready) return;
    const gl = this.gl;
    const w = this.imgW;
    const h = this.imgH;

    const activeImageTex = this.runHealPass() ?? this.imageTex;

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
    runBlur(activeImageTex, this.smallBlurHFBO, this.smallBlurFBO, this.smallBlurTmpTex, 2.0);
    // Large blur: step=18 px (clarity)
    runBlur(activeImageTex, this.largeBlurHFBO, this.largeBlurFBO, this.largeBlurTmpTex, 18.0);

    // ── main pass ────────────────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.mainProg);

    const u = (name: string) => gl.getUniformLocation(this.mainProg, name);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, activeImageTex);
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
    image: HTMLImageElement | HTMLCanvasElement,
    adjustments: Adjustments,
    mimeType: string,
    quality: number, // 0–1
    targetW?: number,
    targetH?: number,
    spots?: SpotGPUData[],
  ): string {
    const srcW = image instanceof HTMLImageElement ? image.naturalWidth  : image.width;
    const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const canvas = document.createElement('canvas');
    canvas.width  = targetW ?? srcW;
    canvas.height = targetH ?? srcH;

    const renderer = new WebGLRenderer();
    renderer.init(canvas, { preserveDrawingBuffer: true });
    renderer.loadImage(image);
    if (spots?.length) renderer.setHealSpots(spots);
    renderer.render(canvas, adjustments);
    const dataUrl = canvas.toDataURL(mimeType, quality);
    renderer.dispose();
    return dataUrl;
  }
}
