import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { createRendererLogger } from '@shared/lib/logger';
import { useAdjustmentsStore } from '@features/develop/edit/store/adjustments-store';
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import {
  useEffectsStore,
  type EffectsState,
} from '@features/develop/edit/effects/model/effects-store';
import { useHealStore } from '@features/develop/heal/store/heal-store';
import { useMaskStore } from '@/features/develop/mask';
import { useCropStore } from '@features/develop/crop/store/crop-store';
import { useHistoryStore } from '@features/develop/history';
import { captureSnapshot } from '@features/develop/history/lib/snapshot';
import { computeHistogram } from '@features/histogram/lib/compute-histogram';
import { AGENT_CHANNELS, AGENT_RESPONSE_PREFIX } from '../const/channels';
import { useAgentStore } from '../store/agent-store';
import type { HealMode } from '@features/develop/heal/store/types';
import type { PhotoExif } from '@features/histogram/lib/read-exif';
import { detectBlemishesWithFace } from '../lib/face-blemish-detector';
import {
  analyzeExposure,
  analyzeColorHarmony,
  checkSkinTones,
  analyzeSaturationMap,
  detectClippingMap,
  analyzeLocalContrast,
} from '../lib/analysis-utils';

/** Summarize histogram into compact stats for AI analysis */
function summarizeHistogram(r: Uint32Array, g: Uint32Array, b: Uint32Array) {
  const summarizeChannel = (ch: Uint32Array) => {
    let total = 0,
      sum = 0;
    for (let i = 0; i < 256; i++) {
      total += ch[i];
      sum += i * ch[i];
    }
    const mean = total > 0 ? Math.round(sum / total) : 0;

    // Zone distribution: shadows (0-63), midtones (64-191), highlights (192-255)
    let shadows = 0,
      midtones = 0,
      highlights = 0;
    for (let i = 0; i < 64; i++) shadows += ch[i];
    for (let i = 64; i < 192; i++) midtones += ch[i];
    for (let i = 192; i < 256; i++) highlights += ch[i];
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    // Clipping: pixels at absolute 0 or 255
    const clippedBlack = ch[0] + ch[1];
    const clippedWhite = ch[254] + ch[255];

    return {
      mean,
      shadows: pct(shadows),
      midtones: pct(midtones),
      highlights: pct(highlights),
      clippedBlack: pct(clippedBlack),
      clippedWhite: pct(clippedWhite),
    };
  };

  return {
    red: summarizeChannel(r),
    green: summarizeChannel(g),
    blue: summarizeChannel(b),
    // Overall luminosity approximation
    luminosity: {
      mean: Math.round(
        summarizeChannel(r).mean * 0.299 +
          summarizeChannel(g).mean * 0.587 +
          summarizeChannel(b).mean * 0.114,
      ),
    },
  };
}

/** Sample average RGB at specific normalized coordinates */
function sampleColorAt(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  normX: number,
  normY: number,
  radius = 3,
) {
  const cx = Math.round(normX * (w - 1));
  const cy = Math.round(normY * (h - 1));
  let rSum = 0,
    gSum = 0,
    bSum = 0,
    count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      const idx = (py * w + px) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/** Analyze image in a 3x3 grid: per-region avg brightness, dominant color, clipping */
function analyzeRegions(data: Uint8ClampedArray, w: number, h: number) {
  const ROWS = 3,
    COLS = 3;
  const regions: Array<{
    position: string;
    avgBrightness: number;
    avgColor: { r: number; g: number; b: number };
    clippedBlack: number;
    clippedWhite: number;
  }> = [];
  const names = [
    'top-left',
    'top-center',
    'top-right',
    'mid-left',
    'center',
    'mid-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.floor((col / COLS) * w);
      const x1 = Math.floor(((col + 1) / COLS) * w);
      const y0 = Math.floor((row / ROWS) * h);
      const y1 = Math.floor(((row + 1) / ROWS) * h);

      let rSum = 0,
        gSum = 0,
        bSum = 0,
        count = 0;
      let blacks = 0,
        whites = 0;
      // Sample every 4th pixel for speed
      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          const idx = (y * w + x) * 4;
          const r = data[idx],
            g = data[idx + 1],
            b = data[idx + 2];
          rSum += r;
          gSum += g;
          bSum += b;
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          if (lum < 3) blacks++;
          if (lum > 252) whites++;
          count++;
        }
      }

      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);
      regions.push({
        position: names[row * COLS + col],
        avgBrightness: Math.round(avgR * 0.299 + avgG * 0.587 + avgB * 0.114),
        avgColor: { r: avgR, g: avgG, b: avgB },
        clippedBlack: Math.round((blacks / count) * 100),
        clippedWhite: Math.round((whites / count) * 100),
      });
    }
  }
  return regions;
}

/** Extract dominant colors using simple color quantization (median-cut-like) */
function getDominantColors(data: Uint8ClampedArray, w: number, h: number, count = 5) {
  // Sample pixels into buckets (quantize to 4-bit per channel = 4096 buckets)
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  const step = Math.max(1, Math.floor((w * h) / 20000)); // sample ~20k pixels
  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const qr = (data[idx] >> 4) << 4;
    const qg = (data[idx + 1] >> 4) << 4;
    const qb = (data[idx + 2] >> 4) << 4;
    const key = (qr << 16) | (qg << 8) | qb;
    const b = buckets.get(key);
    if (b) {
      b.r += data[idx];
      b.g += data[idx + 1];
      b.b += data[idx + 2];
      b.count++;
    } else buckets.set(key, { r: data[idx], g: data[idx + 1], b: data[idx + 2], count: 1 });
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((b) => ({
      r: Math.round(b.r / b.count),
      g: Math.round(b.g / b.count),
      b: Math.round(b.b / b.count),
      percentage: Math.round((b.count / ((w * h) / step)) * 100),
      hex:
        '#' +
        [Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)]
          .map((c) => c.toString(16).padStart(2, '0'))
          .join(''),
    }));
}

/** Measure sharpness per region using Laplacian variance (edge detection) */
function measureSharpness(data: Uint8ClampedArray, w: number, h: number) {
  // Convert to grayscale luminance
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  // Measure Laplacian variance in 3x3 grid regions
  const ROWS = 3,
    COLS = 3;
  const names = [
    'top-left',
    'top-center',
    'top-right',
    'mid-left',
    'center',
    'mid-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];
  const regions: Array<{ position: string; sharpness: number; detail: string }> = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.floor((col / COLS) * w) + 1;
      const x1 = Math.floor(((col + 1) / COLS) * w) - 1;
      const y0 = Math.floor((row / ROWS) * h) + 1;
      const y1 = Math.floor(((row + 1) / ROWS) * h) - 1;

      // Laplacian: L(x,y) = -4*center + top + bottom + left + right
      let variance = 0,
        count = 0;
      for (let y = y0; y < y1; y += 3) {
        for (let x = x0; x < x1; x += 3) {
          const lap =
            -4 * gray[y * w + x] +
            gray[(y - 1) * w + x] +
            gray[(y + 1) * w + x] +
            gray[y * w + (x - 1)] +
            gray[y * w + (x + 1)];
          variance += lap * lap;
          count++;
        }
      }
      const score = Math.round(Math.sqrt(variance / count));
      let detail: string;
      if (score < 5) detail = 'very soft/blurry';
      else if (score < 15) detail = 'soft';
      else if (score < 30) detail = 'moderate';
      else if (score < 50) detail = 'sharp';
      else detail = 'very sharp/high detail';

      regions.push({ position: names[row * COLS + col], sharpness: score, detail });
    }
  }

  const avgScore = Math.round(regions.reduce((s, r) => s + r.sharpness, 0) / regions.length);
  return { overall: avgScore, regions };
}

/** Estimate white balance by analyzing presumably neutral areas */
function estimateWhiteBalance(data: Uint8ClampedArray, w: number, h: number) {
  // Find pixels that are close to neutral (low saturation, mid-brightness)
  let rSum = 0,
    gSum = 0,
    bSum = 0,
    count = 0;
  let totalR = 0,
    totalG = 0,
    totalB = 0,
    totalCount = 0;
  const step = Math.max(1, Math.floor((w * h) / 30000));

  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const r = data[idx],
      g = data[idx + 1],
      b = data[idx + 2];
    totalR += r;
    totalG += g;
    totalB += b;
    totalCount++;

    // Check if pixel is roughly neutral (low chroma, mid-range brightness)
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const chroma = maxC - minC;

    if (chroma < 25 && lum > 50 && lum < 220) {
      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }
  }

  // Average of neutral pixels (if enough found)
  const hasNeutrals = count > 100;
  const neutralAvg = hasNeutrals
    ? { r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count) }
    : null;

  // Overall average
  const overallAvg = {
    r: Math.round(totalR / totalCount),
    g: Math.round(totalG / totalCount),
    b: Math.round(totalB / totalCount),
  };

  // Estimate warmth: R-B difference indicates warm/cool
  const ref = neutralAvg ?? overallAvg;
  const warmth = ref.r - ref.b;
  const tintBias = ref.g - (ref.r + ref.b) / 2;

  let tempDescription: string;
  if (warmth > 30) tempDescription = 'very warm (golden/orange cast)';
  else if (warmth > 15) tempDescription = 'warm';
  else if (warmth > -15) tempDescription = 'neutral';
  else if (warmth > -30) tempDescription = 'cool';
  else tempDescription = 'very cool (blue cast)';

  let tintDescription: string;
  if (tintBias > 15) tintDescription = 'green tint';
  else if (tintBias < -15) tintDescription = 'magenta tint';
  else tintDescription = 'neutral tint';

  return {
    temperature: tempDescription,
    tint: tintDescription,
    warmthScore: warmth,
    tintScore: Math.round(tintBias),
    neutralPixels: hasNeutrals ? count : 0,
    overallAvgColor: overallAvg,
    ...(neutralAvg && { neutralAvgColor: neutralAvg }),
    suggestion:
      warmth > 20
        ? 'Consider reducing temp by -5 to -10'
        : warmth < -20
          ? 'Consider increasing temp by +5 to +10'
          : 'White balance looks acceptable',
  };
}

/** Estimate noise by measuring local variance in dark/mid regions */
function estimateNoise(data: Uint8ClampedArray, w: number, h: number) {
  // Measure noise in shadow regions (where noise is most visible)
  // Use local variance in 5x5 patches as noise indicator
  let shadowNoise = 0,
    shadowCount = 0;
  let midNoise = 0,
    midCount = 0;
  const step = Math.max(5, Math.floor(Math.min(w, h) / 60));

  for (let y = 2; y < h - 2; y += step) {
    for (let x = 2; x < w - 2; x += step) {
      const idx = (y * w + x) * 4;
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

      // Compute local variance in 5x5 patch
      let sumSq = 0,
        sum = 0,
        count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const pi = ((y + dy) * w + (x + dx)) * 4;
          const pl = data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114;
          sum += pl;
          sumSq += pl * pl;
          count++;
        }
      }
      const variance = sumSq / count - (sum / count) ** 2;
      const stddev = Math.sqrt(Math.max(0, variance));

      if (lum < 80) {
        shadowNoise += stddev;
        shadowCount++;
      } else if (lum < 180) {
        midNoise += stddev;
        midCount++;
      }
    }
  }

  const shadowAvg = shadowCount > 0 ? Math.round((shadowNoise / shadowCount) * 10) / 10 : 0;
  const midAvg = midCount > 0 ? Math.round((midNoise / midCount) * 10) / 10 : 0;
  const overall = Math.round((shadowAvg * 0.6 + midAvg * 0.4) * 10) / 10;

  let level: string;
  if (overall < 2) level = 'very clean (low ISO)';
  else if (overall < 4) level = 'clean';
  else if (overall < 7) level = 'moderate noise';
  else if (overall < 12) level = 'noisy (high ISO likely)';
  else level = 'very noisy';

  return {
    level,
    overall,
    shadows: shadowAvg,
    midtones: midAvg,
    suggestion:
      overall > 7
        ? 'Consider minimal clarity/texture to avoid amplifying noise'
        : overall > 4
          ? 'Moderate noise — use texture carefully, avoid over-sharpening'
          : 'Low noise — safe to use texture/clarity freely',
  };
}

type AgentRequest = { requestId: string; payload?: unknown };

/** Soft-clamp adjustment values so AI can't destroy the photo */
const ADJ_LIMITS: Record<string, [number, number]> = {
  exposure: [-2, 2],
  contrast: [-40, 40],
  highlights: [-60, 60],
  shadows: [-60, 60],
  whites: [-40, 40],
  blacks: [-40, 40],
  temp: [-30, 30],
  tint: [-30, 30],
  texture: [-30, 30],
  clarity: [-30, 30],
  dehaze: [-30, 30],
  vibrance: [-40, 40],
  saturation: [-30, 30],
};

function clampAdjustment(key: string, value: number): number {
  const limits = ADJ_LIMITS[key];
  if (!limits) return value;
  return Math.max(limits[0], Math.min(limits[1], value));
}

/** Helper: wrap tool handler with history push */
function withHistory(photoId: string, detail: string, fn: () => void) {
  useHistoryStore.getState().setIsApplying(true);
  fn();
  useHistoryStore.getState().push(photoId, `AI: ${detail}`, detail, captureSnapshot(photoId));
  useHistoryStore.getState().setIsApplying(false);
}

export function useAgentIpc(
  canvasRef: RefObject<ImageCanvasHandle | null>,
  photoId: string | null,
  selected?: ImportedPhoto | null,
  exifData?: PhotoExif | null,
  originalImageUrl?: string | null,
) {
  useEffect(() => {
    const api = window.electron?.agent;
    if (!api) return;

    const respond = (requestId: string, data: unknown) => {
      api.sendToolResult(`${AGENT_RESPONSE_PREFIX}${requestId}`, data);
    };

    const handlers: Record<string, (req: AgentRequest) => void> = {
      // ── Read tools ──────────────────────────────────────────────────
      [AGENT_CHANNELS.GET_SCREENSHOT]: (req) => {
        const payload = req.payload as { quality?: number } | undefined;
        const quality = payload?.quality ?? 0.6;
        useAgentStore.getState().setScanning(true);
        const dataUrl = canvasRef.current?.getExportDataUrl('image/jpeg', quality);
        const base64 = dataUrl?.replace(/^data:image\/jpeg;base64,/, '') ?? '';
        respond(req.requestId, base64);
      },

      [AGENT_CHANNELS.GET_EDIT_STATE]: (req) => {
        if (!photoId) return respond(req.requestId, null);
        respond(req.requestId, captureSnapshot(photoId));
      },

      [AGENT_CHANNELS.GET_PHOTO_INFO]: (req) => {
        if (!photoId) return respond(req.requestId, null);
        respond(req.requestId, {
          photoId,
          fileName: selected?.fileName,
          width: selected?.width,
          height: selected?.height,
          ...(exifData && {
            iso: exifData.iso,
            aperture: exifData.aperture ? `f/${exifData.aperture}` : undefined,
            shutterSpeed: exifData.shutterSpeed,
            focalLength: exifData.focalLength ? `${exifData.focalLength}mm` : undefined,
            camera: [exifData.make, exifData.model].filter(Boolean).join(' ') || undefined,
          }),
        });
      },

      [AGENT_CHANNELS.GET_HISTOGRAM]: (req) => {
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        const { r, g, b } = computeHistogram(pixels.data, pixels.width, pixels.height);
        respond(req.requestId, summarizeHistogram(r, g, b));
      },

      [AGENT_CHANNELS.SAMPLE_COLORS]: (req) => {
        useAgentStore.getState().setScanning(true);
        const payload = req.payload as { points: Array<{ x: number; y: number }> } | undefined;
        if (!payload?.points?.length) return respond(req.requestId, null);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        const samples = payload.points.map((p) => ({
          x: p.x,
          y: p.y,
          ...sampleColorAt(pixels.data, pixels.width, pixels.height, p.x, p.y),
        }));
        respond(req.requestId, samples);
      },

      [AGENT_CHANNELS.ANALYZE_REGIONS]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, analyzeRegions(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.GET_DOMINANT_COLORS]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, getDominantColors(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.MEASURE_SHARPNESS]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, measureSharpness(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.ESTIMATE_WHITE_BALANCE]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, estimateWhiteBalance(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.ESTIMATE_NOISE]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, estimateNoise(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.DETECT_BLEMISHES]: async (req) => {
        const payload = req.payload as { maxSpots?: number } | undefined;
        const pixels = canvasRef.current?.getRenderedPixels();
        // Use original image for face detection (not WebGL processed)
        const imgUrl = originalImageUrl || canvasRef.current?.getExportDataUrl('image/jpeg', 0.95);
        if (!imgUrl || !pixels) return respond(req.requestId, null);
        try {
          const result = await detectBlemishesWithFace(
            imgUrl,
            pixels.data,
            pixels.width,
            pixels.height,
            payload?.maxSpots,
          );
          respond(req.requestId, result);
        } catch (err) {
          createRendererLogger('agent/blemish').error('Detection failed', err);
          respond(req.requestId, { count: 0, spots: [], note: 'Detection failed' });
        }
      },

      // ── Global adjustments ──────────────────────────────────────────
      [AGENT_CHANNELS.SET_ADJUSTMENTS]: (req) => {
        const params = req.payload as Record<string, number> | undefined;
        if (!params || !photoId) return respond(req.requestId, { applied: {} });

        const store = useAdjustmentsStore.getState();
        const applied: Record<string, number> = {};
        const details: string[] = [];

        // Build clamped values
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && key in store.adjustments) {
            const clamped = clampAdjustment(key, value);
            details.push(`${key} ${clamped >= 0 ? '+' : ''}${clamped}`);
          }
        }

        const label = details.join(', ') || 'Adjustments';
        withHistory(photoId, label, () => {
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && key in store.adjustments) {
              const clamped = clampAdjustment(key, value);
              store.setAdjustment(key as keyof typeof store.adjustments, clamped);
              applied[key] = clamped;
            }
          }
        });
        useAgentStore.getState().showActionToast(label);
        respond(req.requestId, { applied });
      },

      [AGENT_CHANNELS.SET_TONE_CURVE]: (req) => {
        const { channel, points, parametric } = (req.payload ?? {}) as {
          channel?: string;
          points?: Array<{ x: number; y: number }>;
          parametric?: { highlights?: number; lights?: number; darks?: number; shadows?: number };
        };
        if (!channel || !photoId) return respond(req.requestId, null);
        const ch = channel as 'rgb' | 'r' | 'g' | 'b';

        withHistory(photoId, `Tone curve ${channel}`, () => {
          const store = useToneCurveStore.getState();
          if (points) store.setPoints(ch, points);
          if (parametric) {
            for (const [key, value] of Object.entries(parametric)) {
              if (typeof value === 'number') {
                store.setParametric(
                  ch,
                  key as 'highlights' | 'lights' | 'darks' | 'shadows',
                  value,
                );
              }
            }
          }
        });
        useAgentStore.getState().showActionToast(`Tone curve: ${channel}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_MIXER]: (req) => {
        const { mode, channel, value } = (req.payload ?? {}) as {
          mode?: string;
          channel?: string;
          value?: number;
        };
        if (!mode || !channel || value === undefined || !photoId)
          return respond(req.requestId, null);

        withHistory(photoId, `Color mixer ${mode}/${channel} = ${value}`, () => {
          useColorMixerStore
            .getState()
            .setValue(mode as 'hue' | 'saturation' | 'luminance', channel as 'red', value);
        });
        useAgentStore.getState().showActionToast(`Color mixer: ${mode}/${channel} = ${value}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_GRADING]: (req) => {
        const { range, hue, sat, lum } = (req.payload ?? {}) as {
          range?: string;
          hue?: number;
          sat?: number;
          lum?: number;
        };
        if (!range || !photoId) return respond(req.requestId, null);

        const patch: Record<string, number> = {};
        if (hue !== undefined) patch.hue = hue;
        if (sat !== undefined) patch.sat = sat;
        if (lum !== undefined) patch.lum = lum;

        withHistory(photoId, `Color grading ${range}`, () => {
          useColorGradingStore
            .getState()
            .setWheel(range as 'shadows' | 'midtones' | 'highlights', patch);
        });
        useAgentStore.getState().showActionToast(`Color grading: ${range}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_EFFECTS]: (req) => {
        const params = req.payload as Record<string, number> | undefined;
        if (!params || !photoId) return respond(req.requestId, null);

        const keys: string[] = [];
        withHistory(photoId, 'Effects', () => {
          const store = useEffectsStore.getState();
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
              store.set(key as keyof EffectsState, value);
              keys.push(key);
            }
          }
        });
        useAgentStore.getState().showActionToast(`Effects: ${keys.join(', ')}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.RESET_ALL]: (req) => {
        if (!photoId) return respond(req.requestId, null);

        withHistory(photoId, 'Reset all', () => {
          useAdjustmentsStore.getState().resetAll();
          useToneCurveStore.getState().reset();
          useColorMixerStore.getState().reset();
          useColorGradingStore.getState().reset();
          useEffectsStore.getState().reset();
        });
        useAgentStore.getState().showActionToast('Reset all edits');
        respond(req.requestId, { ok: true });
      },

      // ── Heal / Clone / Fill ──────────────────────────────────────────
      [AGENT_CHANNELS.ADD_HEAL_SPOT]: (req) => {
        const p = req.payload as {
          mode: HealMode;
          dstX: number;
          dstY: number;
          srcX: number;
          srcY: number;
          radius: number;
          feather?: number;
          opacity?: number;
        };
        if (!p || !photoId) return respond(req.requestId, null);

        const spotId = `spot-${Date.now()}`;
        withHistory(photoId, `${p.mode} spot`, () => {
          useHealStore.getState().addSpot(photoId, {
            id: spotId,
            mode: p.mode,
            dst: { x: p.dstX, y: p.dstY },
            src: { x: p.srcX, y: p.srcY },
            radius: p.radius,
            feather: p.feather ?? 50,
            opacity: p.opacity ?? 100,
          });
        });
        useAgentStore.getState().showActionToast(`${p.mode} spot added`);
        respond(req.requestId, { ok: true, spotId });
      },

      [AGENT_CHANNELS.CLEAR_HEAL_SPOTS]: (req) => {
        if (!photoId) return respond(req.requestId, null);

        withHistory(photoId, 'Clear heal spots', () => {
          useHealStore.getState().clearAll(photoId);
        });
        useAgentStore.getState().showActionToast('Cleared heal spots');
        respond(req.requestId, { ok: true });
      },

      // ── Masking ──────────────────────────────────────────────────────
      [AGENT_CHANNELS.ADD_MASK]: (req) => {
        const p = req.payload as {
          type: 'linear' | 'radial';
          x1?: number;
          y1?: number;
          x2?: number;
          y2?: number;
          cx?: number;
          cy?: number;
          rx?: number;
          ry?: number;
          angle?: number;
          invert?: boolean;
          feather?: number;
        };
        if (!p || !photoId) return respond(req.requestId, null);

        let maskId: string;
        withHistory(photoId, `Add ${p.type} mask`, () => {
          maskId = useMaskStore.getState().addMask(photoId, p.type);
          // Set custom geometry if provided
          if (p.type === 'linear' && (p.x1 !== undefined || p.y1 !== undefined)) {
            useMaskStore.getState().setLinearData(photoId, maskId, {
              x1: p.x1 ?? 0.5,
              y1: p.y1 ?? 0.2,
              x2: p.x2 ?? 0.5,
              y2: p.y2 ?? 0.8,
              feather: p.feather ?? 0.3,
            });
          }
          if (p.type === 'radial' && (p.cx !== undefined || p.cy !== undefined)) {
            useMaskStore.getState().setRadialData(photoId, maskId, {
              cx: p.cx ?? 0.5,
              cy: p.cy ?? 0.5,
              rx: p.rx ?? 0.25,
              ry: p.ry ?? 0.2,
              angle: p.angle ?? 0,
              feather: p.feather ?? 0.3,
              invert: p.invert ?? false,
            });
          }
        });
        useAgentStore.getState().showActionToast(`Added ${p.type} mask`);
        respond(req.requestId, { maskId: maskId! });
      },

      [AGENT_CHANNELS.SET_MASK_ADJUSTMENT]: (req) => {
        const p = req.payload as { maskId: string } & Record<string, number | string | undefined>;
        if (!p?.maskId || !photoId) return respond(req.requestId, null);

        const adjKeys = [
          'exposure',
          'contrast',
          'highlights',
          'shadows',
          'whites',
          'blacks',
          'temp',
          'tint',
          'texture',
          'clarity',
          'dehaze',
          'vibrance',
          'saturation',
        ] as const;

        withHistory(photoId, 'Mask adjustment', () => {
          for (const key of adjKeys) {
            const val = p[key];
            if (typeof val === 'number') {
              useMaskStore.getState().setMaskAdjustment(photoId, p.maskId, key, val);
            }
          }
        });
        useAgentStore.getState().showActionToast('Mask adjustment applied');
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.REMOVE_MASK]: (req) => {
        const { maskId } = (req.payload ?? {}) as { maskId?: string };
        if (!maskId || !photoId) return respond(req.requestId, null);

        withHistory(photoId, 'Remove mask', () => {
          useMaskStore.getState().removeMask(photoId, maskId);
        });
        useAgentStore.getState().showActionToast('Mask removed');
        respond(req.requestId, { ok: true });
      },

      // ── Crop, Rotate & Flip ──────────────────────────────────────────
      [AGENT_CHANNELS.SET_CROP]: (req) => {
        const p = req.payload as {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          rotation?: number;
          rotationSteps?: number;
          flipH?: boolean;
          flipV?: boolean;
          aspectPreset?: string;
        };
        if (!p || !photoId) return respond(req.requestId, null);

        withHistory(photoId, 'Crop/Rotate', () => {
          const patch: Record<string, unknown> = {};
          if (p.x !== undefined || p.y !== undefined || p.w !== undefined || p.h !== undefined) {
            const current = useCropStore.getState().getCrop(photoId);
            patch.rect = {
              x: p.x ?? current.rect.x,
              y: p.y ?? current.rect.y,
              w: p.w ?? current.rect.w,
              h: p.h ?? current.rect.h,
            };
          }
          if (p.rotation !== undefined) patch.rotation = p.rotation;
          if (p.rotationSteps !== undefined) patch.rotationSteps = p.rotationSteps;
          if (p.flipH !== undefined) patch.flipH = p.flipH;
          if (p.flipV !== undefined) patch.flipV = p.flipV;
          if (p.aspectPreset) {
            patch.aspectPreset = p.aspectPreset;
            patch.lockAspect = p.aspectPreset !== 'free';
          }
          useCropStore.getState().setCrop(photoId, patch);
        });
        useAgentStore.getState().showActionToast('Crop/Rotate applied');
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.RESET_CROP]: (req) => {
        if (!photoId) return respond(req.requestId, null);

        withHistory(photoId, 'Reset crop', () => {
          useCropStore.getState().resetCrop(photoId);
        });
        useAgentStore.getState().showActionToast('Crop reset');
        respond(req.requestId, { ok: true });
      },

      // ── Advanced analysis tools ─────────────────────────────────────
      [AGENT_CHANNELS.GET_REGION_SCREENSHOT]: (req) => {
        const payload = req.payload as
          | {
              x: number;
              y: number;
              w: number;
              h: number;
              quality?: number;
            }
          | undefined;
        if (!payload) return respond(req.requestId, null);
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        const { data, width, height } = pixels;
        const rx = Math.max(0, Math.floor(payload.x * width));
        const ry = Math.max(0, Math.floor(payload.y * height));
        const rw = Math.min(width - rx, Math.floor(payload.w * width));
        const rh = Math.min(height - ry, Math.floor(payload.h * height));
        if (rw <= 0 || rh <= 0) return respond(req.requestId, null);
        // Crop pixels into sub-rect
        const cropped = new Uint8ClampedArray(rw * rh * 4);
        for (let y = 0; y < rh; y++) {
          const srcOffset = ((ry + y) * width + rx) * 4;
          const dstOffset = y * rw * 4;
          cropped.set(data.subarray(srcOffset, srcOffset + rw * 4), dstOffset);
        }
        // Draw to offscreen canvas and export
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        const scale = Math.min(1, MAX_DIM / Math.max(rw, rh));
        canvas.width = Math.round(rw * scale);
        canvas.height = Math.round(rh * scale);
        const ctx = canvas.getContext('2d')!;
        const imgData = new ImageData(cropped, rw, rh);
        if (scale < 1) {
          const tmp = document.createElement('canvas');
          tmp.width = rw;
          tmp.height = rh;
          tmp.getContext('2d')!.putImageData(imgData, 0, 0);
          ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.putImageData(imgData, 0, 0);
        }
        const quality = payload.quality ?? 0.8;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        respond(req.requestId, base64);
      },

      [AGENT_CHANNELS.ANALYZE_EXPOSURE]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, analyzeExposure(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.ANALYZE_COLOR_HARMONY]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, analyzeColorHarmony(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.CHECK_SKIN_TONES]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, checkSkinTones(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.ANALYZE_SATURATION_MAP]: (req) => {
        const payload = req.payload as { gridSize?: number } | undefined;
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(
          req.requestId,
          analyzeSaturationMap(pixels.data, pixels.width, pixels.height, payload?.gridSize),
        );
      },

      [AGENT_CHANNELS.DETECT_CLIPPING_MAP]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, detectClippingMap(pixels.data, pixels.width, pixels.height));
      },

      [AGENT_CHANNELS.GET_BEFORE_AFTER]: async (req) => {
        const payload = req.payload as { quality?: number } | undefined;
        const quality = payload?.quality ?? 0.7;
        if (!originalImageUrl) return respond(req.requestId, null);
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load original image'));
            img.src = originalImageUrl;
          });
          const MAX_DIM = 1600;
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
          respond(req.requestId, base64);
        } catch (err) {
          createRendererLogger('agent/before-after').error('Failed to capture original', err);
          respond(req.requestId, null);
        }
      },

      [AGENT_CHANNELS.ANALYZE_LOCAL_CONTRAST]: (req) => {
        useAgentStore.getState().setScanning(true);
        const pixels = canvasRef.current?.getRenderedPixels();
        if (!pixels) return respond(req.requestId, null);
        respond(req.requestId, analyzeLocalContrast(pixels.data, pixels.width, pixels.height));
      },
    };

    const cleanups = Object.entries(handlers).map(([channel, handler]) =>
      api.onToolRequest(channel, (req: AgentRequest) => {
        // Skip bulk edit requests — handled by useBulkAgentIpc
        const payload = req.payload as Record<string, unknown> | undefined;
        if (payload && '__bulkPhotoId' in payload) return;
        handler(req);
      }),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [canvasRef, photoId, selected, exifData, originalImageUrl]);
}
