// ── White Balance ────────────────────────────────────────────────────────────
// Lightroom applies WB as RGB channel multipliers (not offsets) based on
// correlated color temperature along the Planckian locus.
// We work in linear light for accurate color math, then return to gamma.

vec3 applyWhiteBalance(vec3 color) {
  if (abs(u_temp) < 0.5 && abs(u_tint) < 0.5) return color;

  float temp = u_temp / 100.0;   // -1 .. +1
  float tint = u_tint / 100.0;   // -1 .. +1

  // Linearize
  vec3 lin = srgbToLinear(color);

  // Temperature: warm (positive) boosts red, cuts blue.
  // Approximation of Planckian locus shift in RGB space.
  // At temp +1 (~8500 K daylight warm): rMul ~1.18, bMul ~0.82
  // At temp -1 (~3200 K tungsten cool): rMul ~0.82, bMul ~1.18
  float rMul = 1.0 + temp * 0.18;
  float gMul = 1.0 - abs(temp) * 0.015;
  float bMul = 1.0 - temp * 0.18;

  // Tint: green-magenta axis
  // Positive tint = more magenta (reduce green, slight red/blue boost)
  // Negative tint = more green
  rMul *= 1.0 + tint * 0.035;
  gMul *= 1.0 - tint * 0.14;
  bMul *= 1.0 + tint * 0.055;

  lin *= vec3(rMul, gMul, bMul);

  return linearToSrgb(lin);
}
