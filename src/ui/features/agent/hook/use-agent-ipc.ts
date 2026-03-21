import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { useAdjustmentsStore } from '@features/develop/edit/store/adjustments-store';
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import { useEffectsStore } from '@features/develop/edit/effects/model/effects-store';
import { useHealStore } from '@features/develop/heal/store/heal-store';
import { useMaskStore } from '@/features/develop/mask';
import { useCropStore } from '@features/develop/crop/store/crop-store';
import { useHistoryStore } from '@features/develop/history';
import { captureSnapshot } from '@features/develop/history/lib/snapshot';
import { AGENT_CHANNELS, AGENT_RESPONSE_PREFIX } from '../const/channels';
import { useAgentStore } from '../store/agent-store';
import type { HealMode } from '@features/develop/heal/store/types';

type AgentRequest = { requestId: string; payload?: unknown };

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
        const quality = payload?.quality ?? 0.7;
        useAgentStore.getState().setScanning(true);
        // Wait for WebGL to finish rendering latest adjustments before capturing
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const dataUrl = canvasRef.current?.getExportDataUrl('image/jpeg', quality);
            const base64 = dataUrl?.replace(/^data:image\/jpeg;base64,/, '') ?? '';
            setTimeout(() => useAgentStore.getState().setScanning(false), 1200);
            respond(req.requestId, base64);
          });
        });
      },

      [AGENT_CHANNELS.GET_EDIT_STATE]: (req) => {
        if (!photoId) return respond(req.requestId, null);
        respond(req.requestId, captureSnapshot(photoId));
      },

      [AGENT_CHANNELS.GET_PHOTO_INFO]: (req) => {
        respond(req.requestId, photoId ? { photoId } : null);
      },

      // ── Global adjustments ──────────────────────────────────────────
      [AGENT_CHANNELS.SET_ADJUSTMENTS]: (req) => {
        const params = req.payload as Record<string, number> | undefined;
        if (!params || !photoId) return respond(req.requestId, { applied: {} });

        const store = useAdjustmentsStore.getState();
        const applied: Record<string, number> = {};
        const details: string[] = [];

        // Build details first to know what changed
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && key in store.adjustments) {
            details.push(`${key} ${value >= 0 ? '+' : ''}${value}`);
          }
        }

        const label = details.join(', ') || 'Adjustments';
        withHistory(photoId, label, () => {
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && key in store.adjustments) {
              store.setAdjustment(key as keyof typeof store.adjustments, value);
              applied[key] = value;
            }
          }
        });
        useAgentStore.getState().showActionToast(label);
        respond(req.requestId, { applied });
      },

      [AGENT_CHANNELS.SET_TONE_CURVE]: (req) => {
        const { channel, points } = (req.payload ?? {}) as {
          channel?: string; points?: Array<{ x: number; y: number }>;
        };
        if (!channel || !points || !photoId) return respond(req.requestId, null);

        withHistory(photoId, `Tone curve ${channel}`, () => {
          useToneCurveStore.getState().setPoints(channel as 'rgb' | 'r' | 'g' | 'b', points);
        });
        useAgentStore.getState().showActionToast(`Tone curve: ${channel}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_MIXER]: (req) => {
        const { mode, channel, value } = (req.payload ?? {}) as {
          mode?: string; channel?: string; value?: number;
        };
        if (!mode || !channel || value === undefined || !photoId) return respond(req.requestId, null);

        withHistory(photoId, `Color mixer ${mode}/${channel} = ${value}`, () => {
          useColorMixerStore.getState().setValue(mode as 'hue' | 'saturation' | 'luminance', channel as 'red', value);
        });
        useAgentStore.getState().showActionToast(`Color mixer: ${mode}/${channel} = ${value}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_GRADING]: (req) => {
        const { range, hue, sat, lum } = (req.payload ?? {}) as {
          range?: string; hue?: number; sat?: number; lum?: number;
        };
        if (!range || !photoId) return respond(req.requestId, null);

        const patch: Record<string, number> = {};
        if (hue !== undefined) patch.hue = hue;
        if (sat !== undefined) patch.sat = sat;
        if (lum !== undefined) patch.lum = lum;

        withHistory(photoId, `Color grading ${range}`, () => {
          useColorGradingStore.getState().setWheel(range as 'shadows' | 'midtones' | 'highlights', patch);
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
              store.set(key as keyof typeof store, value);
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
          mode: HealMode; dstX: number; dstY: number;
          srcX: number; srcY: number; radius: number;
          feather?: number; opacity?: number;
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
          x1?: number; y1?: number; x2?: number; y2?: number;
          cx?: number; cy?: number; rx?: number; ry?: number;
          angle?: number; invert?: boolean; feather?: number;
        };
        if (!p || !photoId) return respond(req.requestId, null);

        let maskId: string;
        withHistory(photoId, `Add ${p.type} mask`, () => {
          maskId = useMaskStore.getState().addMask(photoId, p.type);
          // Set custom geometry if provided
          if (p.type === 'linear' && (p.x1 !== undefined || p.y1 !== undefined)) {
            useMaskStore.getState().setLinearData(photoId, maskId, {
              x1: p.x1 ?? 0.5, y1: p.y1 ?? 0.2,
              x2: p.x2 ?? 0.5, y2: p.y2 ?? 0.8,
              feather: p.feather ?? 0.3,
            });
          }
          if (p.type === 'radial' && (p.cx !== undefined || p.cy !== undefined)) {
            useMaskStore.getState().setRadialData(photoId, maskId, {
              cx: p.cx ?? 0.5, cy: p.cy ?? 0.5,
              rx: p.rx ?? 0.25, ry: p.ry ?? 0.2,
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

        const adjKeys = ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
          'temp', 'tint', 'texture', 'clarity', 'dehaze', 'vibrance', 'saturation'] as const;

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
          x?: number; y?: number; w?: number; h?: number;
          rotation?: number; rotationSteps?: number;
          flipH?: boolean; flipV?: boolean;
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
    };

    const cleanups = Object.entries(handlers).map(([channel, handler]) =>
      api.onToolRequest(channel, handler),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [canvasRef, photoId]);
}
