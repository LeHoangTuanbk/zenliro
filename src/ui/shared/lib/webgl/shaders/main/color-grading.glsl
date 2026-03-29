// ── Color Grading (3-Way Wheels) ─────────────────────────────────────────────
// Lightroom's color grading applies separate hue tints to shadows, midtones,
// and highlights using smooth luminance-based zone weighting.
// The blending/balance controls affect how the zones overlap.

vec3 applyColorGrading(vec3 rgb) {
  float lm = luma(rgb);

  // ── Zone weights ──────────────────────────────────────────────────
  // Blending: 0 = sharp zone separation, 1 = wide overlap
  float blend = mix(0.25, 0.75, u_cgBlending);
  // Balance: shifts the shadow/highlight crossover point
  float bal = u_cgBalance * 0.35;

  // Smooth Hermite-based zone masks
  float wS = 1.0 - smoothstep(0.0, blend, lm + bal);
  wS = wS * wS * (3.0 - 2.0 * wS);                    // extra smooth

  float wH = smoothstep(1.0 - blend, 1.0, lm + bal);
  wH = wH * wH * (3.0 - 2.0 * wH);

  float wM = 1.0 - smoothstep(0.0, blend, abs(lm - 0.5 + bal));
  wM = wM * wM * (3.0 - 2.0 * wM);

  // Normalize weights
  float total = wS + wM + wH;
  if (total < 0.001) return rgb;
  wS /= total;
  wM /= total;
  wH /= total;

  vec3 hsl = rgb2hsl(rgb);

  // ── Apply shadow tint ─────────────────────────────────────────────
  if (u_cgShadows.y > 0.001) {
    float strength = u_cgShadows.y * wS;
    // Shift hue towards the wheel's target hue
    float targetHue = u_cgShadows.x;
    float hueDiff = targetHue - hsl.x;
    // Wrap around
    if (hueDiff > 0.5) hueDiff -= 1.0;
    if (hueDiff < -0.5) hueDiff += 1.0;
    hsl.x = fract(hsl.x + hueDiff * strength * 0.6);
    hsl.y = clamp(hsl.y + strength * 0.45, 0.0, 1.0);
  }
  hsl.z = clamp(hsl.z + u_cgShadows.z * wS, 0.0, 1.0);

  // ── Apply midtone tint ────────────────────────────────────────────
  if (u_cgMidtones.y > 0.001) {
    float strength = u_cgMidtones.y * wM;
    float targetHue = u_cgMidtones.x;
    float hueDiff = targetHue - hsl.x;
    if (hueDiff > 0.5) hueDiff -= 1.0;
    if (hueDiff < -0.5) hueDiff += 1.0;
    hsl.x = fract(hsl.x + hueDiff * strength * 0.6);
    hsl.y = clamp(hsl.y + strength * 0.45, 0.0, 1.0);
  }
  hsl.z = clamp(hsl.z + u_cgMidtones.z * wM, 0.0, 1.0);

  // ── Apply highlight tint ──────────────────────────────────────────
  if (u_cgHighlights.y > 0.001) {
    float strength = u_cgHighlights.y * wH;
    float targetHue = u_cgHighlights.x;
    float hueDiff = targetHue - hsl.x;
    if (hueDiff > 0.5) hueDiff -= 1.0;
    if (hueDiff < -0.5) hueDiff += 1.0;
    hsl.x = fract(hsl.x + hueDiff * strength * 0.6);
    hsl.y = clamp(hsl.y + strength * 0.45, 0.0, 1.0);
  }
  hsl.z = clamp(hsl.z + u_cgHighlights.z * wH, 0.0, 1.0);

  return hsl2rgb(hsl);
}
