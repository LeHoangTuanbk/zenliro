import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ImageCanvasHandle } from '@widgets/image-canvas/ui/image-canvas';
import { useAdjustmentsStore } from '@features/develop/edit/store/adjustments-store';
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import { useEffectsStore } from '@features/develop/edit/effects/model/effects-store';
import { useHistoryStore } from '@features/develop/history';
import { captureSnapshot } from '@features/develop/history/lib/snapshot';
import { AGENT_CHANNELS, AGENT_RESPONSE_PREFIX } from '../const/channels';
import { useAgentStore } from '../store/agent-store';

type AgentRequest = { requestId: string; payload?: unknown };

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
      [AGENT_CHANNELS.GET_SCREENSHOT]: (req) => {
        const payload = req.payload as { quality?: number } | undefined;
        const quality = payload?.quality ?? 0.7;
        const dataUrl = canvasRef.current?.getExportDataUrl('image/jpeg', quality);
        const base64 = dataUrl?.replace(/^data:image\/jpeg;base64,/, '') ?? '';
        useAgentStore.getState().setScanning(true);
        setTimeout(() => useAgentStore.getState().setScanning(false), 1500);
        respond(req.requestId, base64);
      },

      [AGENT_CHANNELS.GET_EDIT_STATE]: (req) => {
        if (!photoId) return respond(req.requestId, null);
        const snapshot = captureSnapshot(photoId);
        respond(req.requestId, snapshot);
      },

      [AGENT_CHANNELS.GET_PHOTO_INFO]: (req) => {
        respond(req.requestId, photoId ? { photoId } : null);
      },

      [AGENT_CHANNELS.SET_ADJUSTMENTS]: (req) => {
        const params = req.payload as Record<string, number> | undefined;
        if (!params || !photoId) return respond(req.requestId, { applied: {} });

        const store = useAdjustmentsStore.getState();
        const applied: Record<string, number> = {};
        const details: string[] = [];

        useHistoryStore.getState().setIsApplying(true);
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && key in store.adjustments) {
            store.setAdjustment(key as keyof typeof store.adjustments, value);
            applied[key] = value;
            details.push(`${key} ${value >= 0 ? '+' : ''}${value}`);
          }
        }
        useHistoryStore.getState().push(
          photoId, 'AI Agent', details.join(', '), captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);

        useAgentStore.getState().showActionToast(`Adjustments: ${details.join(', ')}`);
        respond(req.requestId, { applied });
      },

      [AGENT_CHANNELS.SET_TONE_CURVE]: (req) => {
        const { channel, points } = (req.payload ?? {}) as {
          channel?: string;
          points?: Array<{ x: number; y: number }>;
        };
        if (!channel || !points || !photoId) return respond(req.requestId, null);

        useHistoryStore.getState().setIsApplying(true);
        useToneCurveStore.getState().setPoints(channel as 'rgb' | 'r' | 'g' | 'b', points);
        useHistoryStore.getState().push(
          photoId, 'AI Agent', `Tone curve ${channel}`, captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);
        useAgentStore.getState().showActionToast(`Tone curve: ${channel}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_MIXER]: (req) => {
        const { mode, channel, value } = (req.payload ?? {}) as {
          mode?: string; channel?: string; value?: number;
        };
        if (!mode || !channel || value === undefined || !photoId)
          return respond(req.requestId, null);

        useHistoryStore.getState().setIsApplying(true);
        useColorMixerStore.getState().setValue(
          mode as 'hue' | 'saturation' | 'luminance',
          channel as 'red',
          value,
        );
        useHistoryStore.getState().push(
          photoId, 'AI Agent', `Color mixer ${mode}/${channel} = ${value}`, captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);
        useAgentStore.getState().showActionToast(`Color mixer: ${mode}/${channel} = ${value}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_COLOR_GRADING]: (req) => {
        const { range, hue, sat, lum } = (req.payload ?? {}) as {
          range?: string; hue?: number; sat?: number; lum?: number;
        };
        if (!range || !photoId) return respond(req.requestId, null);

        useHistoryStore.getState().setIsApplying(true);
        const patch: Record<string, number> = {};
        if (hue !== undefined) patch.hue = hue;
        if (sat !== undefined) patch.sat = sat;
        if (lum !== undefined) patch.lum = lum;
        useColorGradingStore.getState().setWheel(
          range as 'shadows' | 'midtones' | 'highlights',
          patch,
        );
        useHistoryStore.getState().push(
          photoId, 'AI Agent', `Color grading ${range}`, captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);
        useAgentStore.getState().showActionToast(`Color grading: ${range}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.SET_EFFECTS]: (req) => {
        const params = req.payload as Record<string, number> | undefined;
        if (!params || !photoId) return respond(req.requestId, null);

        useHistoryStore.getState().setIsApplying(true);
        const store = useEffectsStore.getState();
        const keys: string[] = [];
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            store.set(key as keyof typeof store, value);
            keys.push(key);
          }
        }
        useHistoryStore.getState().push(
          photoId, 'AI Agent', `Effects: ${keys.join(', ')}`, captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);
        useAgentStore.getState().showActionToast(`Effects: ${keys.join(', ')}`);
        respond(req.requestId, { ok: true });
      },

      [AGENT_CHANNELS.RESET_ALL]: (req) => {
        if (!photoId) return respond(req.requestId, null);

        useHistoryStore.getState().setIsApplying(true);
        useAdjustmentsStore.getState().resetAll();
        useToneCurveStore.getState().reset();
        useColorMixerStore.getState().reset();
        useColorGradingStore.getState().reset();
        useEffectsStore.getState().reset();
        useHistoryStore.getState().push(
          photoId, 'AI Agent', 'Reset all', captureSnapshot(photoId),
        );
        useHistoryStore.getState().setIsApplying(false);
        useAgentStore.getState().showActionToast('Reset all edits');
        respond(req.requestId, { ok: true });
      },
    };

    const cleanups = Object.entries(handlers).map(([channel, handler]) =>
      api.onToolRequest(channel, handler),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [canvasRef, photoId]);
}
