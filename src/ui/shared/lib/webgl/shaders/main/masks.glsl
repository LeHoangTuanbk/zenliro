// ── Local Adjustments (Masks) ────────────────────────────────────────────────
// Brush, linear gradient, and radial gradient masks with per-mask adjustments.
// In the linear pipeline, the working color is in sRGB gamma.
// WB and exposure need to round-trip to linear for correctness.
// Blur reads are gamma-converted from linear RGBA16F textures.

float sampleBrushTex(int slot, vec2 uv) {
  float paint = 0.0, erase = 0.0;
  if (slot == 0)      { paint = texture(u_maskTex0, uv).r; erase = texture(u_maskEraseTex0, uv).r; }
  else if (slot == 1) { paint = texture(u_maskTex1, uv).r; erase = texture(u_maskEraseTex1, uv).r; }
  else if (slot == 2) { paint = texture(u_maskTex2, uv).r; erase = texture(u_maskEraseTex2, uv).r; }
  else                { paint = texture(u_maskTex3, uv).r; erase = texture(u_maskEraseTex3, uv).r; }
  return paint * (1.0 - erase);
}

float sampleMaskWeight(int slot, vec2 uv) {
  int t = u_maskType[slot];
  if (t == 1) {
    return sampleBrushTex(slot, uv);
  }
  if (t == 2) {
    vec4 l = u_maskLinear[slot];
    vec4 lf = vec4(l.x, 1.0 - l.y, l.z, 1.0 - l.w);
    float feath = max(u_maskLinearFeather[slot], 0.001);
    vec2 dir = lf.zw - lf.xy;
    float len2 = length(dir);
    if (len2 < 0.0001) return 0.0;
    float proj = dot(uv - lf.xy, dir / len2) / len2;
    float hw = feath * 0.5;
    return 1.0 - clamp((proj - (0.5 - hw)) / (2.0 * hw), 0.0, 1.0);
  }
  if (t == 3) {
    vec4 r = u_maskRadial[slot];
    vec3 rp = u_maskRadialParams[slot];
    float ang = rp.x * PI / 180.0;
    vec2 center = vec2(r.x, 1.0 - r.y);
    vec2 d2 = uv - center;
    float cosA = cos(ang), sinA = sin(ang);
    vec2 rd = vec2(cosA * d2.x + sinA * d2.y, -sinA * d2.x + cosA * d2.y);
    float dist2 = length(rd / max(r.zw, vec2(0.0001)));
    float feath2 = max(rp.y, 0.001);
    float w2 = 1.0 - smoothstep(1.0 - feath2, 1.0, dist2);
    return rp.z > 0.5 ? 1.0 - w2 : w2;
  }
  return 0.0;
}

// ── Per-mask local adjustment ────────────────────────────────────────────────

vec3 applyLocalAdj(vec3 color, vec2 imageUV, int i) {
  // ── White Balance (round-trip to linear for correctness) ────────────
  float t_ = u_maskTemp[i] / 100.0;
  float tnt_ = u_maskTint_[i] / 100.0;
  if (abs(t_) > 0.005 || abs(tnt_) > 0.005) {
    vec3 lin = srgbToLinear(color);
    float rMul = 1.0 + t_ * 0.18 + tnt_ * 0.035;
    float gMul = (1.0 - abs(t_) * 0.015) * (1.0 - tnt_ * 0.14);
    float bMul = (1.0 - t_ * 0.18) * (1.0 + tnt_ * 0.055);
    lin *= vec3(rMul, gMul, bMul);
    color = linearToSrgb(lin);
  }

  // ── Exposure (round-trip to linear) ─────────────────────────────────
  if (abs(u_maskExp[i]) > 0.005) {
    vec3 lin = srgbToLinear(color);
    lin *= pow(2.0, u_maskExp[i]);
    color = linearToSrgb(lin);
  }

  // ── Tone (Blacks/Shadows/Highlights/Whites) ─────────────────────────
  float lm2 = luma(color);

  float bk = u_maskBlacks[i] / 100.0;
  float shd = u_maskShad[i] / 100.0;
  float hgh = u_maskHigh[i] / 100.0;
  float wht = u_maskWhites[i] / 100.0;

  if (abs(bk) > 0.005 || abs(shd) > 0.005 || abs(hgh) > 0.005 || abs(wht) > 0.005) {
    float blacksW = 1.0 - smoothstep(0.0, 0.22, lm2);
    blacksW *= blacksW;
    float shadowsW = zoneWeight(lm2, 0.20, 0.18);
    shadowsW = max(shadowsW, (1.0 - smoothstep(0.0, 0.50, lm2)) * 0.6);
    float highlightsW = zoneWeight(lm2, 0.80, 0.18);
    highlightsW = max(highlightsW, smoothstep(0.50, 1.0, lm2) * 0.6);
    float whitesW = smoothstep(0.78, 1.0, lm2);
    whitesW *= whitesW;

    float lumAdj = bk * blacksW * 0.30 + shd * shadowsW * 0.50
                 + hgh * highlightsW * 0.50 + wht * whitesW * 0.30;
    float newLum = clamp(lm2 + lumAdj, 0.0, 1.0);

    if (lm2 > 0.001) {
      color *= newLum / lm2;
    } else {
      color += (newLum - lm2);
    }
    color = clamp(color, 0.0, 1.0);
  }

  // ── Contrast ────────────────────────────────────────────────────────
  float con2 = u_maskCon[i] / 100.0;
  if (abs(con2) > 0.005) {
    float pivot = 0.43;
    float factor2 = tan(PI * 0.25 * (1.0 + con2 * 0.55));
    float lumBefore = luma(color);
    float lumAfter = clamp((lumBefore - pivot) * factor2 + pivot, 0.0, 1.0);
    if (lumBefore > 0.001) color *= lumAfter / lumBefore;
    color = clamp(color, 0.0, 1.0);
  }

  // ── Clarity (gamma-convert linear blur) ─────────────────────────────
  float clar2 = u_maskClar[i] / 100.0;
  if (abs(clar2) > 0.005) {
    vec3 lb2 = linearToSrgb(texture(u_largeBlur, imageUV).rgb);
    float lmc2 = luma(color);
    float lumDetail = luma(color - lb2);
    float midMask = exp(-3.5 * (lmc2 - 0.5) * (lmc2 - 0.5));
    midMask = mix(0.12, 1.0, midMask);
    float haloSup = 1.0 / (1.0 + abs(lumDetail) * 6.0);
    float adj = lumDetail * clar2 * midMask * haloSup * 2.8;
    float newL = clamp(lmc2 + adj, 0.0, 1.0);
    if (lmc2 > 0.001) color *= newL / lmc2;
    else color += adj;
    color = clamp(color, 0.0, 1.0);
  }

  // ── Texture (gamma-convert linear blur) ─────────────────────────────
  float texv = u_maskTexVal[i] / 100.0;
  if (abs(texv) > 0.005) {
    vec3 sb2 = linearToSrgb(texture(u_smallBlur, imageUV).rgb);
    float lmc3 = luma(color);
    float lumDet = luma(color - sb2);
    float lumMask = smoothstep(0.02, 0.12, lmc3);
    float adj = lumDet * texv * lumMask * 1.5;
    float newL = clamp(lmc3 + adj, 0.0, 1.0);
    if (lmc3 > 0.001) color *= newL / lmc3;
    else color += adj;
    color = clamp(color, 0.0, 1.0);
  }

  // ── Dehaze (gamma-convert samples + blur) ───────────────────────────
  float dhz2 = u_maskDehaze[i] / 100.0;
  if (abs(dhz2) > 0.005) {
    float dc = sampleDarkChannel(imageUV);
    vec3 lb3 = linearToSrgb(texture(u_largeBlur, imageUV).rgb);
    float A = clamp(max(lb3.r, max(lb3.g, lb3.b)), 0.15, 1.0);
    float trans = clamp(1.0 - 0.90 * abs(dhz2) * dc / A, 0.08, 1.0);
    if (dhz2 > 0.0) {
      vec3 recovered = (color - vec3(A) * (1.0 - trans)) / max(trans, 0.1);
      color = mix(color, recovered, dhz2 * 0.85);
      float grey = luma(color);
      color = mix(vec3(grey), color, 1.0 + dhz2 * 0.22);
      color += (color - lb3) * dhz2 * 0.15;
    } else {
      float negD = -dhz2;
      color = color * (1.0 - negD * 0.4) + vec3(A) * negD * 0.4;
      float grey = luma(color);
      color = mix(color, vec3(grey), negD * 0.3);
    }
    color = clamp(color, 0.0, 1.0);
  }

  // ── Saturation ──────────────────────────────────────────────────────
  float sat2 = u_maskSat[i] / 100.0;
  if (abs(sat2) > 0.005) {
    float grey2 = luma(color);
    color = mix(vec3(grey2), color, 1.0 + sat2);
    color = clamp(color, 0.0, 1.0);
  }

  // ── Vibrance ────────────────────────────────────────────────────────
  float vib2 = u_maskVib[i] / 100.0;
  if (abs(vib2) > 0.005) {
    vec3 hsl2 = rgb2hsl(color);
    float protect2 = 1.0 - hsl2.y;
    float skinDist2 = hueDist(hsl2.x, 35.0 / 360.0);
    float skinFact2 = mix(0.35, 1.0, smoothstep(0.0, 0.08, skinDist2));
    float lumW2 = smoothstep(0.02, 0.10, hsl2.z) * smoothstep(0.98, 0.90, hsl2.z);
    hsl2.y = clamp(hsl2.y + vib2 * protect2 * skinFact2 * lumW2 * 0.85, 0.0, 1.0);
    color = hsl2rgb(hsl2);
  }

  return color;
}
