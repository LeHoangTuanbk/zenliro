// ── Vibrance ─────────────────────────────────────────────────────────────────
// Lightroom vibrance is an "intelligent" saturation control:
//   1. Boosts low-saturation colors more than already-saturated ones
//   2. Protects skin tones (orange/warm hues) from oversaturation
//   3. Luminance-aware: less effect in extreme shadows/highlights
// This makes it much more natural than the saturation slider.

vec3 applyVibrance(vec3 color) {
  if (abs(u_vibrance) < 0.5) return color;

  float vib = u_vibrance / 100.0;
  vec3 hsl = rgb2hsl(color);

  // ── Saturation-based protection ───────────────────────────────────
  // Already-saturated colors get less boost (inverse saturation weighting)
  float satProtect = 1.0 - hsl.y;

  // ── Skin tone protection ──────────────────────────────────────────
  // Lightroom specifically protects orange/warm tones (hue ~20-50 deg)
  // to prevent unnatural skin coloring.
  // Hue in 0-1 range: skin zone = 20/360 to 50/360 = 0.055 to 0.139
  float skinCenter = 35.0 / 360.0; // ~0.097
  float skinDist = hueDist(hsl.x, skinCenter);
  // Closer to skin center → stronger attenuation (down to 35% effect)
  float skinFactor = mix(0.35, 1.0, smoothstep(0.0, 0.08, skinDist));

  // ── Luminance-aware weighting ─────────────────────────────────────
  // Less effect in deep shadows and blown highlights
  float lumWeight = smoothstep(0.02, 0.10, hsl.z) * smoothstep(0.98, 0.90, hsl.z);

  // ── Combined vibrance factor ──────────────────────────────────────
  float amount = vib * satProtect * skinFactor * lumWeight * 0.85;

  hsl.y = clamp(hsl.y + amount, 0.0, 1.0);

  return hsl2rgb(hsl);
}
