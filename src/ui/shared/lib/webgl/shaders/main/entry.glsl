// ── Main Entry Point ─────────────────────────────────────────────────────────
// Processing order follows Lightroom's ACR pipeline:
//   1. Crop & Rotate
//   2. White Balance
//   3. Exposure
//   4. Tone (Blacks/Shadows/Highlights/Whites)
//   5. Contrast
//   6. Clarity / Texture / Dehaze
//   7. Tone Curve
//   8. Color Mixer (HSL)
//   9. Vibrance / Saturation
//  10. Color Grading
//  11. Local Adjustments (Masks)
//  12. Vignette
//  13. Grain

void main() {
  vec2 uv = v_texCoord;

  // ── 1. CROP & ROTATE ──────────────────────────────────────────────
  vec2 imageUV = u_cropOrigin + uv * u_cropSize;

  // Fine rotation (straighten) around crop center
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

  // Flips (in rotated image space)
  if (u_flipH > 0.5) imageUV.x = 1.0 - imageUV.x;
  if (u_flipV > 0.5) imageUV.y = 1.0 - imageUV.y;

  // Undo 90-deg rotation steps to map back to original texture coords
  if (u_rotSteps > 0) {
    int s = u_rotSteps % 4;
    vec2 tmp = imageUV;
    if (s == 1)      imageUV = vec2(1.0 - tmp.y, tmp.x);
    else if (s == 2) imageUV = vec2(1.0 - tmp.x, 1.0 - tmp.y);
    else if (s == 3) imageUV = vec2(tmp.y, 1.0 - tmp.x);
  }

  // Out-of-bounds: dark grey background
  if (imageUV.x < 0.0 || imageUV.x > 1.0 || imageUV.y < 0.0 || imageUV.y > 1.0) {
    fragColor = vec4(0.078, 0.078, 0.078, 1.0);
    return;
  }

  vec3 color = texture(u_image, imageUV).rgb;

  // ── 2. WHITE BALANCE ───────────────────────────────────────────────
  color = applyWhiteBalance(color);

  // ── 3. EXPOSURE ────────────────────────────────────────────────────
  color = applyExposure(color);

  // ── 4. TONE ────────────────────────────────────────────────────────
  color = applyTone(color);

  // ── 5. CONTRAST ────────────────────────────────────────────────────
  color = applyContrast(color);

  // ── 6. CLARITY / TEXTURE / DEHAZE ──────────────────────────────────
  color = applyClarity(color, v_texCoord);
  color = applyTexture(color, v_texCoord);
  color = applyDehaze(color, imageUV, v_texCoord);

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
      vec3 localColor = applyLocalAdj(color, imageUV, v_texCoord, mi);
      color = mix(color, clamp(localColor, 0.0, 1.0), mw);
    }
  }

  // ── 12. VIGNETTE ───────────────────────────────────────────────────
  color = applyVignette(color, uv);

  // ── 13. GRAIN ──────────────────────────────────────────────────────
  color = applyGrain(color, uv);

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
