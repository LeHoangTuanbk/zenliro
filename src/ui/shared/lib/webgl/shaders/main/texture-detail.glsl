// ── Texture ──────────────────────────────────────────────────────────────────
// Lightroom "Texture" enhances medium-frequency detail (skin, fabric, foliage)
// without affecting overall contrast like clarity does. It operates on a
// smaller radius (fine detail) and is luminance-weighted to avoid noise
// amplification in deep shadows.

vec3 applyTexture(vec3 color, vec2 blurCoord) {
  if (abs(u_texture) < 0.5) return color;

  float tex = u_texture / 100.0;
  vec3 blur = texture(u_smallBlur, blurCoord).rgb;

  // Medium-frequency detail
  vec3 detail = color - blur;
  float lumDetail = luma(detail);

  // Luminance-aware: suppress in deep shadows to avoid noise amplification
  float lum = luma(color);
  float lumMask = smoothstep(0.02, 0.12, lum);

  // Apply on luminance to preserve color
  float lumAdj = lumDetail * tex * lumMask * 1.5;
  float newLum = clamp(lum + lumAdj, 0.0, 1.0);

  if (lum > 0.001) {
    color *= newLum / lum;
  } else {
    color += lumAdj;
  }

  return clamp(color, 0.0, 1.0);
}
