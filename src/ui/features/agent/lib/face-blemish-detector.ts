import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

async function ensureModels() {
  if (modelsLoaded) return;
  try {
    console.log('[FaceAPI] Loading models...');
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    modelsLoaded = true;
    console.log('[FaceAPI] Models loaded successfully');
  } catch (err) {
    console.error('[FaceAPI] Failed to load models:', err);
    throw err;
  }
}

/** Load image from data URL */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** 68-landmark index groups */
const LANDMARK_GROUPS = {
  leftEye: { from: 36, to: 41 },
  rightEye: { from: 42, to: 47 },
  nose: { from: 27, to: 35 },
  mouth: { from: 48, to: 67 },
  leftBrow: { from: 17, to: 21 },
  rightBrow: { from: 22, to: 26 },
} as const;

/** Check if a point is inside an exclusion zone around facial features */
function isNearFeature(
  x: number, y: number,
  landmarks: faceapi.FaceLandmarks68,
  margin: number,
): boolean {
  const points = landmarks.positions;

  for (const group of Object.values(LANDMARK_GROUPS)) {
    const featurePoints = points.slice(group.from, group.to + 1);
    for (const p of featurePoints) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < margin) return true;
    }
  }

  // Jawline edges with smaller margin
  const jaw = points.slice(0, 17);
  for (const p of jaw) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < margin * 0.5) return true;
  }

  return false;
}

/** Detect blemishes using face-api for face detection + pixel analysis for spots */
export async function detectBlemishesWithFace(
  dataUrl: string,
  pixelData: Uint8ClampedArray,
  w: number,
  h: number,
  maxSpots = 10,
) {
  await ensureModels();

  // Use the JPEG image for face detection (more reliable than raw pixels)
  const img = await loadImage(dataUrl);
  console.log(`[FaceAPI] Detecting face in ${img.naturalWidth}x${img.naturalHeight} image...`);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
    .withFaceLandmarks();

  if (!detection) {
    console.warn('[FaceAPI] No face detected');
    return { count: 0, spots: [], note: 'No face detected in photo' };
  }

  const { box } = detection.detection;
  const landmarks = detection.landmarks;
  console.log('[FaceAPI] Face detected:', Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height));

  // Scale face coords from detection image to pixel data dimensions
  const scaleX = w / img.naturalWidth;
  const scaleY = h / img.naturalHeight;

  const faceMargin = Math.min(box.width * scaleX, box.height * scaleY) * 0.12;

  // Scan area = face bounding box with padding
  const pad = Math.min(box.width, box.height) * 0.1;
  const fx0 = Math.max(0, Math.floor((box.x - pad) * scaleX));
  const fy0 = Math.max(0, Math.floor((box.y - pad) * scaleY));
  const fx1 = Math.min(w, Math.ceil((box.x + box.width + pad) * scaleX));
  const fy1 = Math.min(h, Math.ceil((box.y + box.height + pad) * scaleY));

  const patchSize = Math.max(2, Math.round(Math.min(box.width * scaleX, box.height * scaleY) / 80));
  const searchRadius = patchSize * 4;
  const step = Math.max(2, Math.round(patchSize * 0.8));

  const data = pixelData;
  const isSkin = (r: number, g: number, b: number) => {
    if (r < 60 || g < 25 || b < 10) return false;
    if (r <= g) return false;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC < 10) return false;
    return true;
  };

  const candidates: Array<{ x: number; y: number; score: number }> = [];

  for (let cy = fy0 + searchRadius; cy < fy1 - searchRadius; cy += step) {
    for (let cx = fx0 + searchRadius; cx < fx1 - searchRadius; cx += step) {
      // Scale back to detection coords for landmark check
      const detX = cx / scaleX;
      const detY = cy / scaleY;
      if (isNearFeature(detX, detY, landmarks, faceMargin / scaleX)) continue;

      const idx = (cy * w + cx) * 4;
      if (idx < 0 || idx >= data.length - 3) continue;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (!isSkin(r, g, b)) continue;

      // Local average in surrounding ring
      let ringR = 0, ringG = 0, ringB = 0, ringCount = 0;
      for (let dy = -searchRadius; dy <= searchRadius; dy += step) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < patchSize * 1.5 || dist > searchRadius) continue;
          const pi = ((cy + dy) * w + (cx + dx)) * 4;
          if (pi < 0 || pi >= data.length - 3) continue;
          if (!isSkin(data[pi], data[pi + 1], data[pi + 2])) continue;
          ringR += data[pi]; ringG += data[pi + 1]; ringB += data[pi + 2];
          ringCount++;
        }
      }
      if (ringCount < 6) continue;

      const avgR = ringR / ringCount;
      const avgG = ringG / ringCount;
      const avgB = ringB / ringCount;

      // Center patch
      let pR = 0, pG = 0, pB = 0, pCount = 0;
      for (let dy = -patchSize; dy <= patchSize; dy++) {
        for (let dx = -patchSize; dx <= patchSize; dx++) {
          const pi = ((cy + dy) * w + (cx + dx)) * 4;
          if (pi < 0 || pi >= data.length - 3) continue;
          pR += data[pi]; pG += data[pi + 1]; pB += data[pi + 2];
          pCount++;
        }
      }
      if (pCount === 0) continue;
      pR /= pCount; pG /= pCount; pB /= pCount;

      const centerLum = pR * 0.299 + pG * 0.587 + pB * 0.114;
      const ringLum = avgR * 0.299 + avgG * 0.587 + avgB * 0.114;
      const lumDiff = ringLum - centerLum;
      const redness = (pR - pG) - (avgR - avgG);

      // Only flag as blemish if significantly darker or redder than surroundings
      // AND the spot is actually dark enough to be a blemish (not a highlight/shine)
      const score = Math.max(0, lumDiff * 0.6 + redness * 0.4);
      const isNotShine = centerLum < ringLum + 5; // not a bright spot / skin shine

      if (score > 12 && isNotShine) {
        candidates.push({ x: cx, y: cy, score });
      }
    }
  }

  // Non-maximum suppression
  candidates.sort((a, b) => b.score - a.score);
  const selected: typeof candidates = [];
  const minDist = patchSize * 5;

  for (const c of candidates) {
    const tooClose = selected.some((s) => {
      const dx = c.x - s.x, dy = c.y - s.y;
      return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
    if (!tooClose) {
      selected.push(c);
      if (selected.length >= maxSpots) break;
    }
  }

  const suggestedRadius = Math.round((patchSize * 1.5 / w) * 1000) / 1000;

  return {
    count: selected.length,
    spots: selected.map((s) => ({
      x: Math.round((s.x / w) * 1000) / 1000,
      y: Math.round((s.y / h) * 1000) / 1000,
      confidence: Math.min(100, Math.round(s.score)),
      suggestedRadius,
    })),
    faceDetected: true,
    faceBox: {
      x: Math.round((box.x / img.naturalWidth) * 1000) / 1000,
      y: Math.round((box.y / img.naturalHeight) * 1000) / 1000,
      w: Math.round((box.width / img.naturalWidth) * 1000) / 1000,
      h: Math.round((box.height / img.naturalHeight) * 1000) / 1000,
    },
    note: selected.length === 0
      ? 'No blemishes detected — skin looks clean'
      : 'Use these coordinates with add_heal_spot (mode: heal, feather: 70, opacity: 85)',
  };
}
