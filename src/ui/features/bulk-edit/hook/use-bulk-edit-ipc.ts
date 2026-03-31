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
import { DEFAULT_ADJUSTMENTS } from '@features/develop/edit/store/adjustments-store';
import { defaultWheel } from '@features/develop/edit/color-grading/store/types';
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

const ADJ_LABELS: Record<string, string> = {
  temp: 'Temp',
  tint: 'Tint',
  exposure: 'Exposure',
  contrast: 'Contrast',
  highlights: 'Highlights',
  shadows: 'Shadows',
  whites: 'Whites',
  blacks: 'Blacks',
  texture: 'Texture',
  clarity: 'Clarity',
  dehaze: 'Dehaze',
  vibrance: 'Vibrance',
  saturation: 'Saturation',
};

const HSL_LABELS: Record<string, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  aqua: 'Aqua',
  blue: 'Blue',
  purple: 'Purple',
  magenta: 'Magenta',
};

const EFFECTS_LABELS: Record<string, string> = {
  vigAmount: 'Vignette',
  vigMidpoint: 'Vig Midpoint',
  vigRoundness: 'Vig Roundness',
  vigFeather: 'Vig Feather',
  vigHighlights: 'Vig Highlights',
  grainAmount: 'Grain',
  grainSize: 'Grain Size',
  grainRoughness: 'Grain Roughness',
};

const EFFECTS_DEFAULTS: Record<string, number> = {
  vigAmount: 0,
  vigMidpoint: 50,
  vigRoundness: 0,
  vigFeather: 50,
  vigHighlights: 0,
  grainAmount: 0,
  grainSize: 25,
  grainRoughness: 50,
};

const fmt = (v: number) => (v > 0 ? '+' : '') + Number(v.toFixed(2));

/** Build a full diff summary of ALL changes (not just first category like generateLabel) */
function buildFullDiff(snapshot: EditSnapshot): { label: string; details: string } {
  const lines: string[] = [];

  // Adjustments
  for (const [key, val] of Object.entries(snapshot.adjustments)) {
    if (val !== DEFAULT_ADJUSTMENTS[key as keyof typeof DEFAULT_ADJUSTMENTS]) {
      lines.push(`${ADJ_LABELS[key] ?? key} ${fmt(val)}`);
    }
  }

  // Color Mixer
  const dch = defaultChannelValues();
  for (const mode of ['hue', 'saturation', 'luminance'] as const) {
    for (const ch of Object.keys(snapshot.colorMixer[mode]) as (keyof typeof dch)[]) {
      const val = snapshot.colorMixer[mode][ch];
      if (val !== 0) {
        const modeShort = mode === 'saturation' ? 'sat' : mode === 'luminance' ? 'lum' : 'hue';
        lines.push(`${HSL_LABELS[ch] ?? ch} ${modeShort} ${fmt(val)}`);
      }
    }
  }

  // Color Grading
  const dw = defaultWheel();
  for (const range of ['shadows', 'midtones', 'highlights'] as const) {
    const w = snapshot.colorGrading[range];
    if (w.hue !== dw.hue || w.sat !== dw.sat || w.lum !== dw.lum) {
      const cap = range.charAt(0).toUpperCase() + range.slice(1);
      lines.push(`${cap} H${Math.round(w.hue)}° S${(w.sat * 100).toFixed(0)}%`);
    }
  }
  if (snapshot.colorGrading.blending !== 50) {
    lines.push(`Blending ${snapshot.colorGrading.blending}`);
  }
  if (snapshot.colorGrading.balance !== 0) {
    lines.push(`Balance ${fmt(snapshot.colorGrading.balance)}`);
  }

  // Effects
  for (const [key, val] of Object.entries(snapshot.effects)) {
    if (val !== EFFECTS_DEFAULTS[key]) {
      lines.push(`${EFFECTS_LABELS[key] ?? key} ${fmt(val)}`);
    }
  }

  // Masks
  if (snapshot.masks.length > 0) {
    lines.push(`${snapshot.masks.length} mask${snapshot.masks.length > 1 ? 's' : ''}`);
  }

  const count = lines.length;
  const label = count > 0 ? `AI Bulk Edit — ${count} changes` : 'AI Bulk Edit';
  const details = lines.join('\n');

  return { label, details };
}

export function useBulkEditIpc() {
  useEffect(() => {
    const api = window.electron?.bulkEdit;
    if (!api) return;

    const store = useBulkEditStore.getState;
    // Guard against duplicate pushes (React StrictMode double-mounts)
    const pushedHistoryFor = new Set<string>();

    const cleanups = [
      api.onJobStatus((data) => {
        store().updateJobStatus(data.photoId, data.status as JobStatus, data.agentIndex);

        // When a job completes, push history entry from offscreen context
        if (data.status === 'done' && !pushedHistoryFor.has(data.photoId)) {
          pushedHistoryFor.add(data.photoId);
          const ctx = bulkContextManager.get(data.photoId);
          if (ctx) {
            const snapshot = buildSnapshotFromContext(ctx);
            const diff = buildFullDiff(snapshot);
            const prompt = store().prompt;
            const promptSummary = prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt;
            const details = `Prompt: ${promptSummary}\n\n${diff.details}`;
            useHistoryStore.getState().push(data.photoId, diff.label, details, snapshot);
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
