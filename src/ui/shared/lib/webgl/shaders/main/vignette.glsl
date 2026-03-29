// ── Vignette ─────────────────────────────────────────────────────────────────
// Lightroom's vignette (Post-Crop Vignetting) with:
//   - Amount: negative = darken, positive = lighten
//   - Midpoint: where the effect starts (0 = center, 1 = corner)
//   - Roundness: -1 = rectangular, 0 = default oval, +1 = circular
//   - Feather: edge softness
//   - Highlights: protects bright areas from darkening

vec3 applyVignette(vec3 color, vec2 uv) {
  if (abs(u_vigAmount) < 0.001) return color;

  vec2 d = uv - 0.5;

  // ── Distance computation ──────────────────────────────────────────
  // Roundness interpolates between rectangular and circular distance
  float rnd = clamp(u_vigRoundness * 0.5 + 0.5, 0.0, 1.0);

  // Circular distance (aspect-corrected)
  float aspect = u_imgAspect;
  vec2 circD = d;
  if (aspect > 1.0) circD.x *= aspect;
  else              circD.y /= aspect;
  float distCircle = length(circD);

  // Rectangular distance (Chebyshev-like)
  float distRect = max(abs(d.x), abs(d.y)) * 1.42;

  float dist = mix(distRect, distCircle, rnd);

  // ── Falloff mask ──────────────────────────────────────────────────
  float mid     = mix(0.08, 0.85, u_vigMidpoint);
  float feather = mix(0.02, 0.65, u_vigFeather);
  float mask    = smoothstep(mid - feather * 0.5, mid + feather * 0.5, dist);

  // ── Apply vignette ────────────────────────────────────────────────
  if (u_vigAmount < 0.0) {
    // Darken vignette
    float strength = -u_vigAmount * mask;

    // Highlight protection: bright pixels resist darkening
    float lumC = luma(color);
    float hiProtect = mix(1.0, max(0.0, 1.0 - lumC * lumC), u_vigHighlights);

    // Apply as multiplicative darkening (matches Lightroom's "Paint Overlay" mode)
    float darken = 1.0 - strength * 0.85 * hiProtect;
    color *= max(darken, 0.0);
  } else {
    // Lighten vignette
    float strength = u_vigAmount * mask;
    color = mix(color, min(vec3(1.0), color + 0.5), strength);
  }

  return color;
}
