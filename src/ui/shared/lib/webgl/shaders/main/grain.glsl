// ── Grain ────────────────────────────────────────────────────────────────────
// Lightroom film grain simulation with:
//   - Amount: overall grain intensity
//   - Size: grain particle size (small = fine, large = coarse)
//   - Roughness: uniform (smooth) vs irregular (rough) grain distribution
// Grain is luminance-weighted: less visible in deep shadows and blown highlights.

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// 2D value noise for smoother grain at larger sizes
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 applyGrain(vec3 color, vec2 uv) {
  if (u_grainAmount < 0.001) return color;

  // Grain cell size in pixels
  float pixelSize = mix(1.0, 6.0, u_grainSize);
  vec2 cell = uv * 2048.0 / pixelSize;

  // Base noise
  float n = hash21(floor(cell)) * 2.0 - 1.0;

  // Roughness shapes the distribution:
  //   Low roughness = smoother, more film-like (blended noise)
  //   High roughness = harsh, gritty
  float rgh = mix(0.2, 1.0, u_grainRoughness);

  // Blend with value noise for smoother grain at low roughness
  float smooth_n = valueNoise(cell) * 2.0 - 1.0;
  n = mix(smooth_n, n, rgh);

  // Shape the noise distribution
  n = sign(n) * pow(abs(n), 1.0 - rgh * 0.5);

  // Strength
  float strength = u_grainAmount * 0.14;

  // Luminance-weighted: less grain in very dark and very bright areas
  // (matches Lightroom's film grain behavior)
  float lum = luma(color);
  float lumWeight = smoothstep(0.0, 0.08, lum) * smoothstep(1.0, 0.92, lum);
  lumWeight = mix(0.3, 1.0, lumWeight);

  color += n * strength * lumWeight;

  return color;
}
