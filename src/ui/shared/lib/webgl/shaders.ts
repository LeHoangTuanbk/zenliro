export const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  v_texCoord = vec2(a_position.x * 0.5 + 0.5, a_position.y * 0.5 + 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const BLUR_FRAG_SRC = /* glsl */ `#version 300 es
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

export const HEAL_FRAG_SRC = /* glsl */ `#version 300 es
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

    vec2  d    = v_texCoord - dst;
    float dist = length(vec2(d.x, d.y * u_hOverW));
    if (dist > radius) continue;

    float alpha;
    if (mode == 2) {
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
      srcColor = u_colorData[i].rgb;
    } else {
      vec2 srcUV = clamp(src + d, vec2(0.0), vec2(1.0));
      srcColor = texture(u_image, srcUV).rgb;
      if (mode == 0) {
        float hw = (1.0 - dist / radius) * 0.6 + 0.4;
        srcColor = clamp(srcColor + u_colorData[i].rgb * hw, 0.0, 1.0);
      }
    }

    color = mix(color, clamp(srcColor, 0.0, 1.0), alpha);
  }

  fragColor = vec4(color, 1.0);
}`;

export const MAIN_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_smallBlur;
uniform sampler2D u_largeBlur;

// Crop & rotate
uniform vec2  u_cropOrigin;
uniform vec2  u_cropSize;
uniform float u_rotation;
uniform float u_flipH;
uniform float u_flipV;
uniform float u_imgAspect;

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

  // ── CROP & ROTATE ──────────────────────────────────────────────────────
  vec2 imageUV = u_cropOrigin + uv * u_cropSize;

  if (u_rotation != 0.0) {
    vec2 center = u_cropOrigin + u_cropSize * 0.5;
    vec2 d = imageUV - center;
    d.x *= u_imgAspect;
    float cosR = cos(-u_rotation);
    float sinR = sin(-u_rotation);
    vec2 rd = vec2(cosR * d.x - sinR * d.y, sinR * d.x + cosR * d.y);
    rd.x /= u_imgAspect;
    imageUV = center + rd;
  }

  if (u_flipH > 0.5) imageUV.x = 1.0 - imageUV.x;
  if (u_flipV > 0.5) imageUV.y = 1.0 - imageUV.y;

  if (imageUV.x < 0.0 || imageUV.x > 1.0 || imageUV.y < 0.0 || imageUV.y > 1.0) {
    fragColor = vec4(0.078, 0.078, 0.078, 1.0);
    return;
  }

  vec3 color = texture(u_image, imageUV).rgb;

  // ── WHITE BALANCE ──────────────────────────────────────────────────────
  float t = u_temp / 100.0;
  color.r += t * 0.12;
  color.g += t * 0.02;
  color.b -= t * 0.12;
  float tint = u_tint / 100.0;
  color.r += tint * 0.04;
  color.g -= tint * 0.08;
  color.b += tint * 0.04;

  // ── EXPOSURE ───────────────────────────────────────────────────────────
  color *= pow(2.0, u_exposure);

  // ── TONE ──────────────────────────────────────────────────────────────
  float lum = luma(color);

  if (abs(u_blacks) > 0.5) {
    float mask = pow(clamp(1.0 - lum / 0.35, 0.0, 1.0), 1.5);
    float adj = (u_blacks / 100.0) * mask;
    color = u_blacks > 0.0
      ? color + adj * (1.0 - color) * 0.5
      : color * (1.0 + adj * 0.8);
    lum = luma(color);
  }

  if (abs(u_shadows) > 0.5) {
    float mask = pow(clamp(1.0 - lum / 0.55, 0.0, 1.0), 1.2);
    float adj = (u_shadows / 100.0) * mask * 0.45;
    color += adj * (1.0 + color * 0.2);
    lum = luma(color);
  }

  if (abs(u_highlights) > 0.5) {
    float mask = pow(clamp((lum - 0.45) / 0.55, 0.0, 1.0), 1.2);
    float adj = (u_highlights / 100.0) * mask * 0.45;
    color += adj * color;
    lum = luma(color);
  }

  if (abs(u_whites) > 0.5) {
    float mask = pow(clamp((lum - 0.65) / 0.35, 0.0, 1.0), 1.5);
    float adj = (u_whites / 100.0) * mask;
    color = u_whites > 0.0
      ? color + adj * (1.0 - color) * 0.5
      : color * (1.0 + adj * 0.4);
  }

  // ── CONTRAST ───────────────────────────────────────────────────────────
  if (abs(u_contrast) > 0.5) {
    float c = u_contrast / 100.0;
    float factor = tan(PI * 0.25 * (1.0 + c * 0.5));
    color = (color - 0.5) * factor + 0.5;
  }

  // ── CLARITY ────────────────────────────────────────────────────────────
  if (abs(u_clarity) > 0.5) {
    vec3 lb = texture(u_largeBlur, v_texCoord).rgb;
    lum = luma(color);
    float mask = 1.0 - abs(lum * 2.0 - 1.0);
    mask = mask * mask;
    color += (color - lb) * (u_clarity / 100.0) * mask * 1.8;
  }

  // ── TEXTURE ────────────────────────────────────────────────────────────
  if (abs(u_texture) > 0.5) {
    vec3 sb = texture(u_smallBlur, v_texCoord).rgb;
    color += (color - sb) * (u_texture / 100.0) * 0.9;
  }

  // ── DEHAZE ─────────────────────────────────────────────────────────────
  if (abs(u_dehaze) > 0.5) {
    vec3 lb = texture(u_largeBlur, v_texCoord).rgb;
    float d = u_dehaze / 100.0;
    color -= d * 0.04;
    color += (color - lb) * d * 0.6;
  }

  // ── SATURATION ─────────────────────────────────────────────────────────
  if (abs(u_saturation) > 0.5) {
    float grey = luma(color);
    color = mix(vec3(grey), color, 1.0 + u_saturation / 100.0);
  }

  // ── VIBRANCE ───────────────────────────────────────────────────────────
  if (abs(u_vibrance) > 0.5) {
    vec3 hsl = rgb2hsl(color);
    float protect = 1.0 - hsl.y;
    hsl.y = clamp(hsl.y + (u_vibrance / 100.0) * protect * 0.65, 0.0, 1.0);
    color = hsl2rgb(hsl);
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;
