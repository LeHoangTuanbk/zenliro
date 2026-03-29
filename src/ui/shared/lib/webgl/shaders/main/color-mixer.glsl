// ── Color Mixer (HSL) ────────────────────────────────────────────────────────
// Lightroom's HSL panel adjusts hue, saturation, and luminance per color range.
// 8 hue channels with smooth, overlapping Gaussian-like influence zones.
// Each channel affects neighboring hues with a bell-shaped falloff.

vec3 applyColorMixer(vec3 rgb) {
  vec3 hsl = rgb2hsl(rgb);
  float h = hsl.x;

  // Skip for near-zero saturation (greys)
  if (hsl.y < 0.01) return rgb;

  // Hue centers (degrees / 360):
  //   Red=0, Orange=30, Yellow=60, Green=120,
  //   Aqua=180, Blue=225, Purple=270, Magenta=315
  float centers[8];
  centers[0] =   0.0 / 360.0;   // Red
  centers[1] =  30.0 / 360.0;   // Orange
  centers[2] =  60.0 / 360.0;   // Yellow
  centers[3] = 120.0 / 360.0;   // Green
  centers[4] = 180.0 / 360.0;   // Aqua
  centers[5] = 225.0 / 360.0;   // Blue
  centers[6] = 270.0 / 360.0;   // Purple
  centers[7] = 315.0 / 360.0;   // Magenta

  // Width of each channel's influence zone.
  // Lightroom uses approximately 30-45 deg per channel depending on spacing.
  // Non-uniform spacing requires adaptive widths.
  float widths[8];
  widths[0] = 28.0 / 360.0;   // Red (narrow — between Magenta and Orange)
  widths[1] = 28.0 / 360.0;   // Orange
  widths[2] = 32.0 / 360.0;   // Yellow
  widths[3] = 40.0 / 360.0;   // Green (wider — larger hue range)
  widths[4] = 38.0 / 360.0;   // Aqua
  widths[5] = 35.0 / 360.0;   // Blue
  widths[6] = 32.0 / 360.0;   // Purple
  widths[7] = 30.0 / 360.0;   // Magenta

  float hueAdj = 0.0;
  float satAdj = 0.0;
  float lumAdj = 0.0;
  float totalW = 0.0;

  for (int i = 0; i < 8; i++) {
    float dist = hueDist(h, centers[i]);
    // Gaussian-like falloff: smooth bell shape
    float sigma = widths[i];
    float w = exp(-0.5 * (dist / sigma) * (dist / sigma));
    // Cut off very small weights
    if (w < 0.01) continue;

    hueAdj += w * u_cmHue[i];
    satAdj += w * u_cmSat[i];
    lumAdj += w * u_cmLum[i];
    totalW += w;
  }

  if (totalW > 0.001) {
    float invW = 1.0 / totalW;
    // Hue shift (in normalized 0-1 hue units)
    hsl.x = fract(hsl.x + hueAdj * invW * (30.0 / 360.0));
    // Saturation (multiplicative — Lightroom behavior)
    hsl.y = clamp(hsl.y * (1.0 + satAdj * invW), 0.0, 1.0);
    // Luminance (additive)
    hsl.z = clamp(hsl.z + lumAdj * invW * 0.45, 0.0, 1.0);
  }

  return hsl2rgb(hsl);
}
