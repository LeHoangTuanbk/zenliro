// ── Main Entry Point ─────────────────────────────────────────────────────────
// Linear pipeline: u_image and blur textures contain LINEAR data (RGBA16F).
//
// Processing order (matches Lightroom ACR):
//   [LINEAR SPACE]  WB → Exposure
//   [TRANSITION]    linearToSrgb()
//   [sRGB/GAMMA]    Tone → Contrast → Clarity → Texture → Dehaze →
//                   Tone Curve → Color Mixer → Vibrance → Saturation →
//                   Color Grading → Masks → Vignette → Grain → Output

void main() {
  vec2 uv = v_texCoord;

  // ── 1. CROP & ROTATE ──────────────────────────────────────────────
  vec2 imageUV = u_cropOrigin + uv * u_cropSize;

  if (u_rotation != 0.0) {
    vec2 center = u_cropOrigin + u_cropSize * 0.5;
    vec2 d = imageUV - center;
    float aspect = (u_rotSteps % 2 == 1) ? (1.0 / u_imgAspect) : u_imgAspect;
    d.x *= aspect;
    float cosR = cos(-u_rotation);
    float sinR = sin(-u_rotation);
    vec2 rd = vec2(cosR * d.x - sinR * d.y, sinR * d.x + cosR * d.y);
    rd.x /= aspect;
    imageUV = center + rd;
  }

  if (u_flipH > 0.5) imageUV.x = 1.0 - imageUV.x;
  if (u_flipV > 0.5) imageUV.y = 1.0 - imageUV.y;

  if (u_rotSteps > 0) {
    int s = u_rotSteps % 4;
    vec2 tmp = imageUV;
    if (s == 1)      imageUV = vec2(1.0 - tmp.y, tmp.x);
    else if (s == 2) imageUV = vec2(1.0 - tmp.x, 1.0 - tmp.y);
    else if (s == 3) imageUV = vec2(tmp.y, 1.0 - tmp.x);
  }

  if (imageUV.x < 0.0 || imageUV.x > 1.0 || imageUV.y < 0.0 || imageUV.y > 1.0) {
    fragColor = vec4(0.078, 0.078, 0.078, 1.0);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██ LINEAR SPACE — u_image contains linear data (RGBA16F)
  // ══════════════════════════════════════════════════════════════════════
  vec3 color = texture(u_image, imageUV).rgb;  // already linear

  // ── 2. WHITE BALANCE (linear multiply — no hue shift) ──────────────
  color = applyWhiteBalance(color);

  // ── 3. EXPOSURE (2^EV in linear — physically correct) ──────────────
  color = applyExposure(color);

  // ══════════════════════════════════════════════════════════════════════
  // ██ TRANSITION: linear → sRGB gamma (perceptual working space)
  // ██ 16-bit float precision prevents banding in recovered shadows
  // ══════════════════════════════════════════════════════════════════════
  color = linearToSrgb(clamp(color, 0.0, 1.0));

  // ══════════════════════════════════════════════════════════════════════
  // ██ sRGB/GAMMA SPACE — perceptual operations
  // ══════════════════════════════════════════════════════════════════════

  // ── 4. TONE ────────────────────────────────────────────────────────
  color = applyTone(color);

  // ── 5. CONTRAST ────────────────────────────────────────────────────
  color = applyContrast(color);

  // ── 6. CLARITY / TEXTURE / DEHAZE ──────────────────────────────────
  // Blur textures live in image space, so sample them with imageUV.
  color = applyClarity(color, imageUV);
  color = applyTexture(color, imageUV);
  color = applyDehaze(color, imageUV);

  // ── 7. TONE CURVE ──────────────────────────────────────────────────
  color = clamp(color, 0.0, 1.0);
  color = applyToneCurve(color);

  // ── 8. COLOR MIXER ─────────────────────────────────────────────────
  color = applyColorMixer(color);

  // ── 9. VIBRANCE / SATURATION ───────────────────────────────────────
  color = applyVibrance(color);
  color = applySaturation(color);

  // ── 10. COLOR GRADING ──────────────────────────────────────────────
  color = applyColorGrading(color);

  // ── 11. LOCAL ADJUSTMENTS (MASKS) ──────────────────────────────────
  for (int mi = 0; mi < MAX_MASKS; mi++) {
    if (mi >= u_maskCount || u_maskType[mi] == 0) continue;
    float mw = sampleMaskWeight(mi, imageUV);
    if (mw > 0.001) {
      vec3 localColor = applyLocalAdj(color, imageUV, mi);
      color = mix(color, clamp(localColor, 0.0, 1.0), mw);
    }
  }

  // ── 12. VIGNETTE ───────────────────────────────────────────────────
  color = applyVignette(color, uv);

  // ── 13. GRAIN ──────────────────────────────────────────────────────
  color = applyGrain(color, uv);

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
