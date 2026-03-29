// ── Saturation ───────────────────────────────────────────────────────────────
// Lightroom saturation adjusts all colors equally (unlike vibrance).
// Simple luminance-weighted desaturation/boost.

vec3 applySaturation(vec3 color) {
  if (abs(u_saturation) < 0.5) return color;

  float sat = u_saturation / 100.0;
  float grey = luma(color);

  // Linear interpolation between greyscale and color
  // sat=+1 doubles saturation; sat=-1 fully desaturates
  color = mix(vec3(grey), color, 1.0 + sat);

  return clamp(color, 0.0, 1.0);
}
