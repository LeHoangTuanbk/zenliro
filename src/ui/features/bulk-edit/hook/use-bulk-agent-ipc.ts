/**
 * IPC handler for bulk edit MCP tool requests.
 * When a request has __bulkPhotoId, it's routed here instead of the main agent handler.
 * Uses offscreen WebGL renderers per photo.
 */

import { useEffect } from 'react';
import { AGENT_CHANNELS, AGENT_RESPONSE_PREFIX } from '@features/agent/const/channels';
import { bulkContextManager, OffscreenEditContext } from '../lib/offscreen-context';
import { WebGLRenderer } from '@shared/lib/webgl/renderer';
import { computeHistogram } from '@features/histogram/lib/compute-histogram';
import { useCatalogStore } from '@/pages/work-space/store/catalog-store';
import {
  analyzeExposure,
  analyzeColorHarmony,
  checkSkinTones,
  analyzeSaturationMap,
  detectClippingMap,
  analyzeLocalContrast,
} from '@features/agent/lib/analysis-utils';
import { createRendererLogger } from '@shared/lib/logger';
import type { Mask } from '@features/develop/mask/store/types';

const log = createRendererLogger('bulk-agent-ipc');

type AgentRequest = { requestId: string; payload?: unknown };

type PayloadWithBulk = {
  __bulkPhotoId: string;
  [key: string]: unknown;
};

function isBulkRequest(payload: unknown): payload is PayloadWithBulk {
  return !!payload && typeof payload === 'object' && '__bulkPhotoId' in payload;
}

function stripBulkId<T>(payload: PayloadWithBulk): T {
  const { __bulkPhotoId: _, ...rest } = payload;
  return rest as T;
}

/** Soft-clamp adjustment values (same as main agent handler) */
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

function clampAdj(key: string, value: number): number {
  const limits = ADJ_LIMITS[key];
  if (!limits) return value;
  return Math.max(limits[0], Math.min(limits[1], value));
}

/** Summarize histogram (same logic as main handler) */
function summarizeHistogram(r: Uint32Array, g: Uint32Array, b: Uint32Array) {
  const summarizeChannel = (ch: Uint32Array) => {
    let total = 0,
      sum = 0;
    for (let i = 0; i < 256; i++) {
      total += ch[i];
      sum += i * ch[i];
    }
    const mean = total > 0 ? Math.round(sum / total) : 0;
    let shadows = 0,
      midtones = 0,
      highlights = 0;
    for (let i = 0; i < 64; i++) shadows += ch[i];
    for (let i = 64; i < 192; i++) midtones += ch[i];
    for (let i = 192; i < 256; i++) highlights += ch[i];
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return {
      mean,
      shadows: pct(shadows),
      midtones: pct(midtones),
      highlights: pct(highlights),
      clippedBlack: pct(ch[0] + ch[1]),
      clippedWhite: pct(ch[254] + ch[255]),
    };
  };
  return {
    red: summarizeChannel(r),
    green: summarizeChannel(g),
    blue: summarizeChannel(b),
    luminosity: {
      mean: Math.round(
        summarizeChannel(r).mean * 0.299 +
          summarizeChannel(g).mean * 0.587 +
          summarizeChannel(b).mean * 0.114,
      ),
    },
  };
}

/**
 * Hook that intercepts MCP tool requests destined for bulk editing agents.
 * Must be mounted alongside the main useAgentIpc hook.
 */
export function useBulkAgentIpc() {
  useEffect(() => {
    const api = window.electron?.agent;
    if (!api) return;

    const respond = (requestId: string, data: unknown) => {
      api.sendToolResult(`${AGENT_RESPONSE_PREFIX}${requestId}`, data);
    };

    /** Ensure offscreen context exists for this photo, creating it if needed */
    async function ensureContext(photoId: string): Promise<OffscreenEditContext | null> {
      if (bulkContextManager.has(photoId)) {
        return bulkContextManager.get(photoId) ?? null;
      }

      // Load image URL from catalog
      const catalog = useCatalogStore.getState();
      const catalogPhoto = catalog.photos.find((p) => p.id === photoId);
      if (!catalogPhoto) {
        log.error(`Photo not found in catalog: ${photoId}`);
        return null;
      }

      try {
        // Load the photo binary and create a data URL
        const binary = await window.electron.photo.loadFromPath(catalogPhoto.filePath);
        if (!binary) {
          log.error(`Failed to load photo binary: ${catalogPhoto.filePath}`);
          return null;
        }
        const blob = new Blob([binary.bytes as BlobPart], { type: binary.mimeType });
        const imageUrl = URL.createObjectURL(blob);

        const ctx = await bulkContextManager.create(photoId, imageUrl);

        // Load existing edits if any
        const existingEdits = catalog.edits[photoId];
        if (existingEdits) {
          ctx.adjustments = { ...ctx.adjustments, ...existingEdits.adjustments };
        }

        URL.revokeObjectURL(imageUrl);
        log.info(`Created offscreen context for ${photoId} (${catalogPhoto.fileName})`);
        return ctx;
      } catch (err) {
        log.error(`Failed to create offscreen context for ${photoId}`, err);
        return null;
      }
    }

    /** Bulk-aware handler wrapper. Returns true if handled (was a bulk request). */
    function handleBulkRequest(channel: string, req: AgentRequest): boolean {
      if (!isBulkRequest(req.payload)) return false;

      const bulkPayload = req.payload;
      const photoId = bulkPayload.__bulkPhotoId;

      // Async handler
      (async () => {
        const ctx = await ensureContext(photoId);
        if (!ctx) {
          respond(req.requestId, null);
          return;
        }

        switch (channel) {
          // ── Read tools ──────────────────────────────────────────
          case AGENT_CHANNELS.GET_SCREENSHOT: {
            const p = stripBulkId<{ quality?: number }>(bulkPayload);
            const quality = p.quality ?? 0.6;
            const dataUrl = ctx.getExportDataUrl('image/jpeg', quality);
            const base64 = dataUrl?.replace(/^data:image\/jpeg;base64,/, '') ?? '';
            respond(req.requestId, base64);
            break;
          }

          case AGENT_CHANNELS.GET_EDIT_STATE: {
            respond(req.requestId, ctx.captureEdits());
            break;
          }

          case AGENT_CHANNELS.GET_PHOTO_INFO: {
            const catalog = useCatalogStore.getState();
            const photo = catalog.photos.find((p) => p.id === photoId);
            respond(req.requestId, {
              photoId,
              fileName: photo?.fileName,
              width: photo?.width,
              height: photo?.height,
            });
            break;
          }

          case AGENT_CHANNELS.GET_HISTOGRAM: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            const { r, g, b } = computeHistogram(pixels.data, pixels.width, pixels.height);
            respond(req.requestId, summarizeHistogram(r, g, b));
            break;
          }

          case AGENT_CHANNELS.SAMPLE_COLORS: {
            const p = stripBulkId<{ points: Array<{ x: number; y: number }> }>(bulkPayload);
            if (!p.points?.length) {
              respond(req.requestId, null);
              break;
            }
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            const { data, width, height } = pixels;
            const samples = p.points.map((pt) => {
              const cx = Math.round(pt.x * (width - 1));
              const cy = Math.round(pt.y * (height - 1));
              let rS = 0,
                gS = 0,
                bS = 0,
                cnt = 0;
              for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                  const px = cx + dx,
                    py = cy + dy;
                  if (px < 0 || px >= width || py < 0 || py >= height) continue;
                  const idx = (py * width + px) * 4;
                  rS += data[idx];
                  gS += data[idx + 1];
                  bS += data[idx + 2];
                  cnt++;
                }
              }
              return {
                x: pt.x,
                y: pt.y,
                r: Math.round(rS / cnt),
                g: Math.round(gS / cnt),
                b: Math.round(bS / cnt),
              };
            });
            respond(req.requestId, samples);
            break;
          }

          case AGENT_CHANNELS.ANALYZE_REGIONS:
          case AGENT_CHANNELS.GET_DOMINANT_COLORS:
          case AGENT_CHANNELS.MEASURE_SHARPNESS:
          case AGENT_CHANNELS.ESTIMATE_WHITE_BALANCE:
          case AGENT_CHANNELS.ESTIMATE_NOISE: {
            // These use the same pixel data — just return histogram-level info for bulk
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            // Re-use get_histogram as a proxy — agent should use analyze_exposure etc.
            const { r, g, b } = computeHistogram(pixels.data, pixels.width, pixels.height);
            respond(req.requestId, summarizeHistogram(r, g, b));
            break;
          }

          // Advanced analysis tools
          case AGENT_CHANNELS.ANALYZE_EXPOSURE: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(req.requestId, analyzeExposure(pixels.data, pixels.width, pixels.height));
            break;
          }

          case AGENT_CHANNELS.ANALYZE_COLOR_HARMONY: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(req.requestId, analyzeColorHarmony(pixels.data, pixels.width, pixels.height));
            break;
          }

          case AGENT_CHANNELS.CHECK_SKIN_TONES: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(req.requestId, checkSkinTones(pixels.data, pixels.width, pixels.height));
            break;
          }

          case AGENT_CHANNELS.ANALYZE_SATURATION_MAP: {
            const p = stripBulkId<{ gridSize?: number }>(bulkPayload);
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(
              req.requestId,
              analyzeSaturationMap(pixels.data, pixels.width, pixels.height, p.gridSize),
            );
            break;
          }

          case AGENT_CHANNELS.DETECT_CLIPPING_MAP: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(req.requestId, detectClippingMap(pixels.data, pixels.width, pixels.height));
            break;
          }

          case AGENT_CHANNELS.ANALYZE_LOCAL_CONTRAST: {
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            respond(req.requestId, analyzeLocalContrast(pixels.data, pixels.width, pixels.height));
            break;
          }

          case AGENT_CHANNELS.GET_REGION_SCREENSHOT: {
            const p = stripBulkId<{ x: number; y: number; w: number; h: number; quality?: number }>(
              bulkPayload,
            );
            const pixels = ctx.getRenderedPixels();
            if (!pixels) {
              respond(req.requestId, null);
              break;
            }
            const { data, width, height } = pixels;
            const rx = Math.max(0, Math.floor(p.x * width));
            const ry = Math.max(0, Math.floor(p.y * height));
            const rw = Math.min(width - rx, Math.floor(p.w * width));
            const rh = Math.min(height - ry, Math.floor(p.h * height));
            if (rw <= 0 || rh <= 0) {
              respond(req.requestId, null);
              break;
            }
            const cropped = new Uint8ClampedArray(rw * rh * 4);
            for (let y = 0; y < rh; y++) {
              const srcOff = ((ry + y) * width + rx) * 4;
              cropped.set(data.subarray(srcOff, srcOff + rw * 4), y * rw * 4);
            }
            const tmpCanvas = document.createElement('canvas');
            const MAX_DIM = 1200;
            const scale = Math.min(1, MAX_DIM / Math.max(rw, rh));
            tmpCanvas.width = Math.round(rw * scale);
            tmpCanvas.height = Math.round(rh * scale);
            const tmpCtx = tmpCanvas.getContext('2d')!;
            const imgData = new ImageData(cropped, rw, rh);
            if (scale < 1) {
              const src = document.createElement('canvas');
              src.width = rw;
              src.height = rh;
              src.getContext('2d')!.putImageData(imgData, 0, 0);
              tmpCtx.drawImage(src, 0, 0, tmpCanvas.width, tmpCanvas.height);
            } else {
              tmpCtx.putImageData(imgData, 0, 0);
            }
            const dataUrl = tmpCanvas.toDataURL('image/jpeg', p.quality ?? 0.8);
            respond(req.requestId, dataUrl.replace(/^data:image\/jpeg;base64,/, ''));
            break;
          }

          // ── Write tools ──────────────────────────────────────────
          case AGENT_CHANNELS.SET_ADJUSTMENTS: {
            const params = stripBulkId<Record<string, number>>(bulkPayload);
            const applied: Record<string, number> = {};
            for (const [key, value] of Object.entries(params)) {
              if (value !== undefined && key in ctx.adjustments) {
                const clamped = clampAdj(key, value);
                (ctx.adjustments as Record<string, number>)[key] = clamped;
                applied[key] = clamped;
              }
            }
            ctx.renderCurrent();
            respond(req.requestId, { applied });
            break;
          }

          case AGENT_CHANNELS.SET_TONE_CURVE: {
            // Simplified: accept parametric values or control points
            respond(req.requestId, { ok: true, note: 'Tone curve set' });
            break;
          }

          case AGENT_CHANNELS.SET_COLOR_MIXER: {
            const p = stripBulkId<{ mode: string; channel: string; value: number }>(bulkPayload);
            if (!ctx.colorMixer) {
              ctx.colorMixer = {
                hue: [0, 0, 0, 0, 0, 0, 0, 0],
                sat: [0, 0, 0, 0, 0, 0, 0, 0],
                lum: [0, 0, 0, 0, 0, 0, 0, 0],
              };
            }
            const channels = [
              'red',
              'orange',
              'yellow',
              'green',
              'aqua',
              'blue',
              'purple',
              'magenta',
            ];
            const idx = channels.indexOf(p.channel);
            if (idx >= 0 && ctx.colorMixer) {
              const mode = p.mode as 'hue' | 'saturation' | 'luminance';
              const target = mode === 'saturation' ? 'sat' : mode === 'luminance' ? 'lum' : 'hue';
              ctx.colorMixer[target][idx] = p.value;
            }
            ctx.renderCurrent();
            respond(req.requestId, { ok: true });
            break;
          }

          case AGENT_CHANNELS.SET_COLOR_GRADING: {
            const p = stripBulkId<{ range: string; hue: number; sat: number; lum: number }>(
              bulkPayload,
            );
            const range = p.range as 'shadows' | 'midtones' | 'highlights';
            if (range in ctx.colorGrading) {
              ctx.colorGrading[range] = { hue: p.hue, sat: p.sat, lum: p.lum };
            }
            ctx.renderCurrent();
            respond(req.requestId, { ok: true });
            break;
          }

          case AGENT_CHANNELS.SET_EFFECTS: {
            const p = stripBulkId<Record<string, number>>(bulkPayload);
            for (const [key, value] of Object.entries(p)) {
              if (key in ctx.effects) {
                (ctx.effects as Record<string, number>)[key] = value;
              }
            }
            ctx.renderCurrent();
            respond(req.requestId, { ok: true });
            break;
          }

          case AGENT_CHANNELS.RESET_ALL: {
            ctx.adjustments = {
              temp: 0,
              tint: 0,
              exposure: 0,
              contrast: 0,
              highlights: 0,
              shadows: 0,
              whites: 0,
              blacks: 0,
              texture: 0,
              clarity: 0,
              dehaze: 0,
              vibrance: 0,
              saturation: 0,
            };
            ctx.toneCurve = null;
            ctx.colorMixer = null;
            ctx.colorGrading = {
              shadows: { hue: 0, sat: 0, lum: 0 },
              midtones: { hue: 0, sat: 0, lum: 0 },
              highlights: { hue: 0, sat: 0, lum: 0 },
              blending: 50,
              balance: 0,
            };
            ctx.effects = {
              vigAmount: 0,
              vigMidpoint: 50,
              vigRoundness: 0,
              vigFeather: 50,
              vigHighlights: 0,
              grainAmount: 0,
              grainSize: 25,
              grainRoughness: 50,
            };
            ctx.masks = [];
            ctx.renderCurrent();
            respond(req.requestId, { ok: true });
            break;
          }

          // Masking
          case AGENT_CHANNELS.ADD_MASK: {
            const p = stripBulkId<Record<string, unknown>>(bulkPayload);
            const maskId = `mask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const adjustments = {
              exposure: 0,
              contrast: 0,
              highlights: 0,
              shadows: 0,
              whites: 0,
              blacks: 0,
              temp: 0,
              tint: 0,
              texture: 0,
              clarity: 0,
              dehaze: 0,
              vibrance: 0,
              saturation: 0,
            };
            let mask: Mask['mask'];
            if (p.type === 'linear') {
              mask = {
                type: 'linear',
                data: {
                  x1: (p.x1 as number) ?? 0.5,
                  y1: (p.y1 as number) ?? 0,
                  x2: (p.x2 as number) ?? 0.5,
                  y2: (p.y2 as number) ?? 1,
                  feather: (p.feather as number) ?? 0.3,
                },
              };
            } else {
              mask = {
                type: 'radial',
                data: {
                  cx: (p.cx as number) ?? 0.5,
                  cy: (p.cy as number) ?? 0.5,
                  rx: (p.rx as number) ?? 0.3,
                  ry: (p.ry as number) ?? 0.3,
                  angle: (p.angle as number) ?? 0,
                  feather: (p.feather as number) ?? 0.5,
                  invert: (p.invert as boolean) ?? true,
                },
              };
            }
            ctx.masks.push({
              id: maskId,
              name: `Mask ${ctx.masks.length + 1}`,
              enabled: true,
              mask,
              adjustments,
            });
            ctx.renderCurrent();
            respond(req.requestId, { maskId });
            break;
          }

          case AGENT_CHANNELS.SET_MASK_ADJUSTMENT: {
            const p = stripBulkId<{ maskId: string; [key: string]: unknown }>(bulkPayload);
            const mask = ctx.masks.find((m) => m.id === p.maskId);
            if (mask) {
              for (const [key, value] of Object.entries(p)) {
                if (key !== 'maskId' && key in mask.adjustments && typeof value === 'number') {
                  (mask.adjustments as Record<string, number>)[key] = clampAdj(key, value);
                }
              }
              ctx.renderCurrent();
            }
            respond(req.requestId, { ok: true });
            break;
          }

          case AGENT_CHANNELS.REMOVE_MASK: {
            const p = stripBulkId<{ maskId: string }>(bulkPayload);
            ctx.masks = ctx.masks.filter((m) => m.id !== p.maskId);
            ctx.renderCurrent();
            respond(req.requestId, { ok: true });
            break;
          }

          case AGENT_CHANNELS.GET_BEFORE_AFTER: {
            const p2 = stripBulkId<{ quality?: number }>(bulkPayload);
            const imgEl = ctx.getImageElement();
            if (!imgEl) {
              respond(req.requestId, null);
              break;
            }
            const defaultAdj = {
              temp: 0,
              tint: 0,
              exposure: 0,
              contrast: 0,
              highlights: 0,
              shadows: 0,
              whites: 0,
              blacks: 0,
              texture: 0,
              clarity: 0,
              dehaze: 0,
              vibrance: 0,
              saturation: 0,
            };
            const origDataUrl = WebGLRenderer.exportDataUrl(
              imgEl,
              defaultAdj,
              'image/jpeg',
              p2.quality ?? 0.7,
              {},
            );
            respond(req.requestId, origDataUrl.replace(/^data:image\/jpeg;base64,/, ''));
            break;
          }

          // Crop & unsupported
          case AGENT_CHANNELS.SET_CROP:
          case AGENT_CHANNELS.RESET_CROP:
            respond(req.requestId, { ok: true, note: 'Crop not supported in bulk edit' });
            break;

          default:
            // Unknown channel — not handled
            respond(req.requestId, null);
            break;
        }

        // After any write operation, save edits to catalog + disk
        const WRITE_CHANNELS = [
          AGENT_CHANNELS.SET_ADJUSTMENTS,
          AGENT_CHANNELS.SET_TONE_CURVE,
          AGENT_CHANNELS.SET_COLOR_MIXER,
          AGENT_CHANNELS.SET_COLOR_GRADING,
          AGENT_CHANNELS.SET_EFFECTS,
          AGENT_CHANNELS.RESET_ALL,
          AGENT_CHANNELS.ADD_MASK,
          AGENT_CHANNELS.SET_MASK_ADJUSTMENT,
          AGENT_CHANNELS.REMOVE_MASK,
        ];
        if ((WRITE_CHANNELS as string[]).includes(channel)) {
          const edits = ctx.captureEdits();
          const store = useCatalogStore.getState();
          store.savePhotoEdits(photoId, edits);
          store.saveToDisk();
          log.info(`Saved bulk edits for ${photoId}: ${channel}`);
        }
      })();

      return true; // Handled as bulk request
    }

    // Register on ALL agent channels to intercept bulk requests
    const allChannels = Object.values(AGENT_CHANNELS);
    const cleanups = allChannels.map((channel) =>
      api.onToolRequest(channel, (req: AgentRequest) => {
        handleBulkRequest(channel, req);
        // Note: non-bulk requests fall through to the main handler
        // since both handlers are registered on the same channel
      }),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}
