import { useEffect } from 'react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import { bulkContextManager } from '../lib/offscreen-context';
import { useHistoryStore } from '@features/develop/history/store/history-store';
import { DEFAULT_CROP_STATE } from '@features/develop/crop/store/types';
import {
  defaultCurvePoints,
  defaultParametricPerChannel,
} from '@features/develop/edit/tone-curve/store/types';
import { defaultChannelValues } from '@features/develop/edit/color-mixer/store/types';
import { HSL_CHANNELS } from '@features/develop/edit/color-mixer/store/types';
import { createRendererLogger } from '@shared/lib/logger';
import type { EditSnapshot } from '@features/develop/history/store/types';
import type { JobStatus } from '../const/channels';
import type { OffscreenEditContext } from '../lib/offscreen-context';

const log = createRendererLogger('bulk-edit-ipc');

/** Build an EditSnapshot from offscreen context state for history */
function buildSnapshotFromContext(ctx: OffscreenEditContext): EditSnapshot {
  const cm = ctx.colorMixer;
  const hue = defaultChannelValues();
  const saturation = defaultChannelValues();
  const luminance = defaultChannelValues();

  if (cm) {
    HSL_CHANNELS.forEach((ch, i) => {
      hue[ch] = cm.hue[i] ?? 0;
      saturation[ch] = cm.sat[i] ?? 0;
      luminance[ch] = cm.lum[i] ?? 0;
    });
  }

  return structuredClone({
    adjustments: ctx.adjustments,
    toneCurve: {
      points: defaultCurvePoints(),
      parametric: defaultParametricPerChannel(),
    },
    colorMixer: { hue, saturation, luminance },
    colorGrading: {
      shadows: ctx.colorGrading.shadows,
      midtones: ctx.colorGrading.midtones,
      highlights: ctx.colorGrading.highlights,
      blending: ctx.colorGrading.blending,
      balance: ctx.colorGrading.balance,
    },
    effects: { ...ctx.effects },
    crop: DEFAULT_CROP_STATE,
    healSpots: [],
    masks: ctx.masks,
  });
}

export function useBulkEditIpc() {
  useEffect(() => {
    const api = window.electron?.bulkEdit;
    if (!api) return;

    const store = useBulkEditStore.getState;

    const cleanups = [
      api.onJobStatus((data) => {
        store().updateJobStatus(data.photoId, data.status as JobStatus, data.agentIndex);

        // When a job completes, push history entry from offscreen context
        if (data.status === 'done') {
          const ctx = bulkContextManager.get(data.photoId);
          if (ctx) {
            const snapshot = buildSnapshotFromContext(ctx);
            const prompt = store().prompt;
            const label = 'AI Bulk Edit';
            const details = prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt;
            useHistoryStore.getState().push(data.photoId, label, details, snapshot);
            log.info(`Pushed history entry for ${data.photoId}`);
          }
        }
      }),
      api.onJobThinking((data) => {
        store().updateJobThinking(data.photoId, data.text);
      }),
      api.onJobText((data) => {
        // Show agent text output as thinking fallback (most visible agent activity)
        store().updateJobThinking(data.photoId, data.text);
      }),
      api.onJobToolUse((data) => {
        store().updateJobToolUse(data.photoId, data.name);
      }),
      api.onJobError((_data) => {
        // Error status already handled by onJobStatus
      }),
      api.onAllDone((summary) => {
        store().setAllDone(summary);
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}
