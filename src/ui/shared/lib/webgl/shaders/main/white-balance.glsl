// ── White Balance ────────────────────────────────────────────────────────────
// Applied in LINEAR space (before gamma conversion). This is critical:
// in linear, channel multipliers correctly scale photon counts along the
// Planckian locus. In gamma space, the same multipliers cause hue shifts
// because the nonlinear transfer distorts the ratios.

vec3 applyWhiteBalance(vec3 color) {
  if (abs(u_temp) < 0.5 && abs(u_tint) < 0.5) return color;

  float temp = u_temp / 100.0;   // -1 .. +1
  float tint = u_tint / 100.0;   // -1 .. +1

  // Temperature: Planckian locus approximation as RGB multipliers.
  // In linear space these are direct energy ratios.
  float rMul = 1.0 + temp * 0.18;
  float gMul = 1.0 - abs(temp) * 0.015;
  float bMul = 1.0 - temp * 0.18;

  // Tint: green-magenta axis
  rMul *= 1.0 + tint * 0.035;
  gMul *= 1.0 - tint * 0.14;
  bMul *= 1.0 + tint * 0.055;

  return color * vec3(rMul, gMul, bMul);
}
