// ── Clarity ──────────────────────────────────────────────────────────────────
// Local contrast enhancement. Blur textures are in LINEAR space (RGBA16F),
// so we gamma-convert them to match the working color (which is now in sRGB).
// This ensures the high-pass extraction is perceptually correct.

vec3 applyClarity(vec3 color, vec2 imageUV) {
  if (abs(u_clarity) < 0.5) return color;

  float clar = u_clarity / 100.0;

  // Gamma-convert the linear blur to match our sRGB working color
  vec3 blur = linearToSrgb(texture(u_largeBlur, imageUV).rgb);

  // Local contrast detail (high-pass via unsharp mask)
  vec3 detail = color - blur;
  float lumDetail = luma(detail);

  // Midtone mask: Gaussian bell centered at 0.5, floor at 12%
  float lum = luma(color);
  float midMask = exp(-3.5 * (lum - 0.5) * (lum - 0.5));
  midMask = mix(0.12, 1.0, midMask);

  // Halo suppression: reduce where local contrast is already extreme
  float detailMag = abs(lumDetail);
  float haloSuppress = 1.0 / (1.0 + detailMag * 6.0);

  // Apply to luminance channel with color-ratio preservation
  float lumAdj = lumDetail * clar * midMask * haloSuppress * 2.8;
  float newLum = clamp(lum + lumAdj, 0.0, 1.0);
  if (lum > 0.001) {
    color *= newLum / lum;
  } else {
    color += lumAdj;
  }

  return clamp(color, 0.0, 1.0);
}
