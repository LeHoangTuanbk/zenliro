// ── Tone Curve ───────────────────────────────────────────────────────────────
// Per-channel LUT lookup (256x1 RGBA texture).
// The LUT is pre-computed on the CPU from the user's control points using
// cubic spline interpolation, identical to Lightroom's curve editor.

vec3 applyToneCurve(vec3 color) {
  float r = texture(u_toneCurveLUT, vec2(clamp(color.r, 0.0, 1.0), 0.5)).r;
  float g = texture(u_toneCurveLUT, vec2(clamp(color.g, 0.0, 1.0), 0.5)).g;
  float b = texture(u_toneCurveLUT, vec2(clamp(color.b, 0.0, 1.0), 0.5)).b;
  return vec3(r, g, b);
}
