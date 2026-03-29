// ── Clarity ──────────────────────────────────────────────────────────────────
// Lightroom clarity = local contrast enhancement using a large-radius
// unsharp mask. Key differences from naive USM:
//   1. Soft Gaussian midtone weighting (not hard quadratic cutoff)
//   2. Halo suppression to prevent bright/dark ringing at edges
//   3. Luminance-based application to minimize color shifts
//   4. Stronger overall effect to match ACR's visible impact

vec3 applyClarity(vec3 color, vec2 blurCoord) {
  if (abs(u_clarity) < 0.5) return color;

  float clar = u_clarity / 100.0;
  vec3 blur = texture(u_largeBlur, blurCoord).rgb;

  // Local contrast detail (high-pass via unsharp mask)
  vec3 detail = color - blur;
  float lumDetail = luma(detail);

  // ── Midtone mask (Gaussian bell at 0.5, sigma ~0.38) ──────────────
  // Lightroom clarity affects midtones strongly but doesn't completely
  // exclude shadows/highlights — there's a floor of ~12%.
  float lum = luma(color);
  float midMask = exp(-3.5 * (lum - 0.5) * (lum - 0.5));
  midMask = mix(0.12, 1.0, midMask);

  // ── Halo suppression ──────────────────────────────────────────────
  // Reduce enhancement where local contrast is already extreme
  // to prevent bright/dark halos at strong edges.
  float detailMag = abs(lumDetail);
  float haloSuppress = 1.0 / (1.0 + detailMag * 6.0);

  // ── Apply to luminance channel ─────────────────────────────────────
  // Working on luminance preserves color relationships.
  float lumAdj = lumDetail * clar * midMask * haloSuppress * 2.8;

  // Color-ratio preservation: scale RGB by luminance change
  float newLum = clamp(lum + lumAdj, 0.0, 1.0);
  if (lum > 0.001) {
    color *= newLum / lum;
  } else {
    color += lumAdj;
  }

  return clamp(color, 0.0, 1.0);
}
