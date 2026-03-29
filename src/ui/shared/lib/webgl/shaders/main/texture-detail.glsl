// ── Texture ──────────────────────────────────────────────────────────────────
// Medium-frequency detail enhancement. Blur is in linear, gamma-convert
// to match the sRGB working color.

vec3 applyTexture(vec3 color, vec2 imageUV) {
  if (abs(u_texture) < 0.5) return color;

  float tex = u_texture / 100.0;

  // Gamma-convert linear blur
  vec3 blur = linearToSrgb(texture(u_smallBlur, imageUV).rgb);

  vec3 detail = color - blur;
  float lumDetail = luma(detail);

  // Shadow noise suppression
  float lum = luma(color);
  float lumMask = smoothstep(0.02, 0.12, lum);

  // Apply on luminance with color-ratio preservation
  float lumAdj = lumDetail * tex * lumMask * 1.5;
  float newLum = clamp(lum + lumAdj, 0.0, 1.0);

  if (lum > 0.001) {
    color *= newLum / lum;
  } else {
    color += lumAdj;
  }

  return clamp(color, 0.0, 1.0);
}
