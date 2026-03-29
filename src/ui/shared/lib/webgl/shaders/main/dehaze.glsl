// ── Dehaze ───────────────────────────────────────────────────────────────────
// Lightroom's dehaze is based on the Dark Channel Prior (He et al., 2009).
// Physical model of atmospheric scattering:
//   I(x) = J(x) * t(x) + A * (1 - t(x))
// where:
//   I = observed (hazy) image
//   J = scene radiance (what we want to recover)
//   t = transmission map (how much light reaches the camera)
//   A = atmospheric light (ambient haze color)
//
// We compute the dark channel by sampling min(R,G,B) from the ORIGINAL image
// over a 3x3 grid (~15px patch), which closely matches the paper's patch-based
// min operation. Atmospheric light is estimated from the large blur.

float sampleDarkChannel(vec2 centerUV) {
  // 3x3 grid sampling with ~8px spacing → effective 16x16 pixel patch
  // This matches the DCP paper's 15x15 patch recommendation
  float patchStep = 8.0 / float(textureSize(u_image, 0).x);
  float dc = 1.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 sampleUV = clamp(centerUV + vec2(float(i), float(j)) * patchStep, 0.0, 1.0);
      vec3 s = texture(u_image, sampleUV).rgb;
      dc = min(dc, min(s.r, min(s.g, s.b)));
    }
  }
  return dc;
}

vec3 applyDehaze(vec3 color, vec2 imageUV, vec2 blurCoord) {
  if (abs(u_dehaze) < 0.5) return color;

  float dh = u_dehaze / 100.0;

  // ── Dark channel from original image ───────────────────────────────
  float darkChannel = sampleDarkChannel(imageUV);

  // ── Atmospheric light estimation ──────────────────────────────────
  // Use the large blur to estimate global scene brightness.
  // A is the maximum channel in the blurred image (approximates the
  // brightest region where dark channel is also high).
  vec3 blur = texture(u_largeBlur, blurCoord).rgb;
  float A = clamp(max(blur.r, max(blur.g, blur.b)), 0.15, 1.0);

  // ── Transmission map ──────────────────────────────────────────────
  // t = 1 - omega * darkChannel / A
  // omega controls how much haze to remove (0.95 = aggressive)
  float omega = 0.90 * abs(dh);
  float transmission = 1.0 - omega * darkChannel / A;
  transmission = clamp(transmission, 0.08, 1.0);

  if (dh > 0.0) {
    // ── Positive dehaze: remove haze ──────────────────────────────────
    // Recover scene radiance: J = (I - A*(1-t)) / t
    vec3 atmosVec = vec3(A);
    vec3 recovered = (color - atmosVec * (1.0 - transmission)) / max(transmission, 0.1);

    // Blend by strength — full dh=1 gives nearly complete recovery
    color = mix(color, recovered, dh * 0.85);

    // Slight saturation boost (Lightroom behavior: dehaze reveals color)
    float grey = luma(color);
    color = mix(vec3(grey), color, 1.0 + dh * 0.22);

    // Micro-contrast boost to enhance recovered detail
    vec3 localDetail = color - blur;
    color += localDetail * dh * 0.15;
  } else {
    // ── Negative dehaze: add haze ─────────────────────────────────────
    float negD = -dh;

    // Simulate haze by blending towards atmospheric light
    vec3 atmosVec = vec3(A);
    vec3 hazy = color * (1.0 - negD * 0.4) + atmosVec * negD * 0.4;

    // Desaturate (haze reduces color purity)
    float grey = luma(hazy);
    color = mix(hazy, vec3(grey), negD * 0.3);
  }

  return clamp(color, 0.0, 1.0);
}
