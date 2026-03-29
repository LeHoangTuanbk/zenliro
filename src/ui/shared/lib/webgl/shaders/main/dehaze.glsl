// ── Dehaze ───────────────────────────────────────────────────────────────────
// Dark Channel Prior (He et al., 2009) in the linear pipeline.
// u_image contains LINEAR data; we gamma-convert samples for the DCP since
// the haze model operates in the perceptual/display domain.
// Blur is also linear → gamma-converted for atmospheric light estimation.

float sampleDarkChannel(vec2 centerUV) {
  // 3x3 grid sampling with ~8px spacing → ~16x16 pixel patch
  vec2 patchStep = 8.0 / vec2(textureSize(u_image, 0));
  float dc = 1.0;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 sampleUV = clamp(centerUV + vec2(float(i), float(j)) * patchStep, 0.0, 1.0);
      // Read linear, convert to gamma for perceptual dark channel
      vec3 s = linearToSrgb(texture(u_image, sampleUV).rgb);
      dc = min(dc, min(s.r, min(s.g, s.b)));
    }
  }
  return dc;
}

vec3 applyDehaze(vec3 color, vec2 imageUV) {
  if (abs(u_dehaze) < 0.5) return color;

  float dh = u_dehaze / 100.0;

  // Dark channel from gamma-converted original image
  float darkChannel = sampleDarkChannel(imageUV);

  // Atmospheric light from gamma-converted blur (global estimate)
  vec3 blur = linearToSrgb(texture(u_largeBlur, imageUV).rgb);
  float A = clamp(max(blur.r, max(blur.g, blur.b)), 0.15, 1.0);

  // Transmission map
  float omega = 0.90 * abs(dh);
  float transmission = 1.0 - omega * darkChannel / A;
  transmission = clamp(transmission, 0.08, 1.0);

  if (dh > 0.0) {
    // Remove haze: J = (I - A*(1-t)) / t
    vec3 atmosVec = vec3(A);
    vec3 recovered = (color - atmosVec * (1.0 - transmission)) / max(transmission, 0.1);
    color = mix(color, recovered, dh * 0.85);

    // Saturation boost (Lightroom behavior)
    float grey = luma(color);
    color = mix(vec3(grey), color, 1.0 + dh * 0.22);

    // Micro-contrast boost
    vec3 localDetail = color - blur;
    color += localDetail * dh * 0.15;
  } else {
    // Add haze
    float negD = -dh;
    vec3 atmosVec = vec3(A);
    vec3 hazy = color * (1.0 - negD * 0.4) + atmosVec * negD * 0.4;
    float grey = luma(hazy);
    color = mix(hazy, vec3(grey), negD * 0.3);
  }

  return clamp(color, 0.0, 1.0);
}
