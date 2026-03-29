// ── Contrast ─────────────────────────────────────────────────────────────────
// Lightroom applies contrast as an S-curve pivoting around ~18% grey
// (approximately 0.18 linear = 0.45 in gamma/sRGB space).
// We use a tangent-based S-curve which closely matches ACR's behavior.

vec3 applyContrast(vec3 color) {
  if (abs(u_contrast) < 0.5) return color;

  float c = u_contrast / 100.0;

  // Pivot at 18% grey in gamma space (matches Lightroom's midtone anchor)
  const float pivot = 0.43;

  // S-curve via tangent — stronger than linear, matches ACR's visible strength
  float factor = tan(PI * 0.25 * (1.0 + c * 0.55));

  // Preserve color ratios while applying contrast
  float lumBefore = luma(color);
  vec3 contrasted = (color - pivot) * factor + pivot;
  float lumAfter = luma(contrasted);

  // Blend luminance-change into original color to preserve hue
  if (lumBefore > 0.001 && lumAfter > 0.0) {
    color *= lumAfter / lumBefore;
  } else {
    color = contrasted;
  }

  return clamp(color, 0.0, 1.0);
}
