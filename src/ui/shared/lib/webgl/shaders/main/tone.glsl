// ── Exposure + Tone (Blacks / Shadows / Highlights / Whites) ─────────────────
// Lightroom's Process Version 2012+ tone controls use overlapping luminance
// zones with Gaussian-like falloff and color-ratio preservation.
// The key difference from naive implementations: adjustments change luminance
// while keeping RGB ratios intact, preventing unwanted hue shifts.

vec3 applyExposure(vec3 color) {
  if (abs(u_exposure) < 0.005) return color;
  // Standard photographic EV stops — identical to Lightroom
  return color * pow(2.0, u_exposure);
}

vec3 applyTone(vec3 color) {
  float bk = u_blacks / 100.0;
  float sh = u_shadows / 100.0;
  float hi = u_highlights / 100.0;
  float wh = u_whites / 100.0;

  if (abs(bk) < 0.005 && abs(sh) < 0.005 && abs(hi) < 0.005 && abs(wh) < 0.005) {
    return color;
  }

  float lum = luma(color);

  // ── Zone masks ────────────────────────────────────────────────────────
  // Modeled after Adobe ACR 2012 parametric zones:
  //   Blacks  : strong at 0%,    fades by ~20%
  //   Shadows : peaks ~18-25%,   range ~0-55%
  //   Highlights: peaks ~75-82%, range ~45-100%
  //   Whites  : strong at 100%,  fades by ~80%

  // Blacks: ramp from 1.0 at lum=0 to 0.0 at lum~0.22 (soft knee)
  float blacksW = 1.0 - smoothstep(0.0, 0.22, lum);
  blacksW *= blacksW;

  // Shadows: Gaussian-like bell centered at ~0.20, sigma ~0.18
  // Plus a tail that covers deep shadows
  float shadowsW = zoneWeight(lum, 0.20, 0.18);
  shadowsW = max(shadowsW, (1.0 - smoothstep(0.0, 0.50, lum)) * 0.6);

  // Highlights: Gaussian-like bell centered at ~0.80, sigma ~0.18
  // Plus a tail that covers bright areas
  float highlightsW = zoneWeight(lum, 0.80, 0.18);
  highlightsW = max(highlightsW, smoothstep(0.50, 1.0, lum) * 0.6);

  // Whites: ramp from 0.0 at lum~0.78 to 1.0 at lum=1.0
  float whitesW = smoothstep(0.78, 1.0, lum);
  whitesW *= whitesW;

  // ── Compute new luminance ─────────────────────────────────────────────
  // Lightroom-calibrated strengths (measured against ACR output)
  float lumAdj = 0.0;
  lumAdj += bk * blacksW  * 0.30;   // blacks: strong but narrow
  lumAdj += sh * shadowsW * 0.50;   // shadows: moderate, wide
  lumAdj += hi * highlightsW * 0.50; // highlights: moderate, wide
  lumAdj += wh * whitesW  * 0.30;   // whites: strong but narrow

  float newLum = clamp(lum + lumAdj, 0.0, 1.0);

  // ── Color-ratio preservation ──────────────────────────────────────────
  // Scale RGB proportionally so hue and saturation remain constant.
  // This is the key to matching Lightroom's color-stable tone mapping.
  if (lum > 0.001) {
    color *= newLum / lum;
  } else {
    // Near-black: additive shift to avoid division instability
    color += (newLum - lum);
  }

  return clamp(color, 0.0, 1.0);
}
