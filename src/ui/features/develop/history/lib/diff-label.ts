import type { EditSnapshot } from '../store/types';

export type DiffResult = { label: string; details: string };

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

const EFFECTS_LABELS: Record<string, string> = {
  vigAmount: 'Vignette Amount',
  vigMidpoint: 'Vignette Midpoint',
  vigRoundness: 'Vignette Roundness',
  vigFeather: 'Vignette Feather',
  vigHighlights: 'Vignette Highlights',
  grainAmount: 'Grain Amount',
  grainSize: 'Grain Size',
  grainRoughness: 'Grain Roughness',
};

const CHANNEL_LABELS: Record<string, string> = {
  rgb: 'RGB',
  r: 'Red',
  g: 'Green',
  b: 'Blue',
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

const MODE_LABELS: Record<string, string> = {
  hue: 'Hue',
  saturation: 'Saturation',
  luminance: 'Luminance',
};

const fmt = (v: number) => (v > 0 ? '+' : '') + Number(v.toFixed(2));

function diffMasks(prev: EditSnapshot, next: EditSnapshot): DiffResult {
  for (let i = 0; i < next.masks.length; i++) {
    const pm = prev.masks[i];
    const nm = next.masks[i];
    if (!pm || JSON.stringify(pm) === JSON.stringify(nm)) continue;

    // Mask adjustments changed
    if (JSON.stringify(pm.adjustments) !== JSON.stringify(nm.adjustments)) {
      const changes: string[] = [];
      for (const key of Object.keys(nm.adjustments) as (keyof typeof nm.adjustments)[]) {
        if (pm.adjustments[key] !== nm.adjustments[key]) {
          const cap = ADJ_LABELS[key] ?? key;
          changes.push(`${cap} ${fmt(nm.adjustments[key])}`);
        }
      }
      return {
        label: `${nm.name}: ${changes[0] ?? 'Edit'}`,
        details: changes.join('\n'),
      };
    }

    // Mask shape changed (brush stroke, linear/radial data)
    if (JSON.stringify(pm.mask) !== JSON.stringify(nm.mask)) {
      const type = nm.mask.type;
      if (type === 'brush') {
        const prevStrokes = pm.mask.type === 'brush' ? pm.mask.strokes.length : 0;
        const nextStrokes = nm.mask.strokes.length;
        const action = nextStrokes > prevStrokes ? 'Paint' : 'Erase';
        return { label: `${nm.name}: ${action}`, details: `${nextStrokes} strokes` };
      }
      return { label: `${nm.name}: Move`, details: `Type: ${type}` };
    }

    // Toggle enabled
    if (pm.enabled !== nm.enabled) {
      return { label: `${nm.name}: ${nm.enabled ? 'Show' : 'Hide'}`, details: '' };
    }

    return { label: `Edit ${nm.name}`, details: '' };
  }
  return { label: 'Edit Mask', details: '' };
}

export function generateLabel(prev: EditSnapshot | null, next: EditSnapshot): DiffResult {
  if (!prev) return { label: 'Import', details: 'Initial state' };

  // Adjustments — collect ALL changed keys
  const adjChanges: string[] = [];
  for (const key of Object.keys(next.adjustments) as (keyof typeof next.adjustments)[]) {
    if (prev.adjustments[key] !== next.adjustments[key]) {
      adjChanges.push(`${ADJ_LABELS[key]} ${fmt(next.adjustments[key])}`);
    }
  }
  if (adjChanges.length > 0) {
    return { label: adjChanges[0], details: adjChanges.join('\n') };
  }

  // Tone Curve — identify channel and parametric changes
  if (JSON.stringify(prev.toneCurve) !== JSON.stringify(next.toneCurve)) {
    const details: string[] = [];
    for (const ch of ['rgb', 'r', 'g', 'b'] as const) {
      if (JSON.stringify(prev.toneCurve.points[ch]) !== JSON.stringify(next.toneCurve.points[ch])) {
        const pts = next.toneCurve.points[ch].length;
        details.push(`${CHANNEL_LABELS[ch]} curve: ${pts} points`);
      }
    }
    for (const ch of ['rgb', 'r', 'g', 'b'] as const) {
      const prevP = prev.toneCurve.parametric[ch];
      const nextP = next.toneCurve.parametric[ch];
      for (const key of Object.keys(nextP) as (keyof typeof nextP)[]) {
        if (prevP[key] !== nextP[key]) {
          const cap = key.charAt(0).toUpperCase() + key.slice(1);
          const chLabel = ch === 'rgb' ? '' : ` (${CHANNEL_LABELS[ch]})`;
          details.push(`${cap}${chLabel} ${fmt(nextP[key])}`);
        }
      }
    }
    const changedCh = (['rgb', 'r', 'g', 'b'] as const).find(
      (ch) =>
        JSON.stringify(prev.toneCurve.points[ch]) !== JSON.stringify(next.toneCurve.points[ch]),
    );
    const label = changedCh
      ? `Tone Curve ${CHANNEL_LABELS[changedCh]}`
      : `Tone Curve ${details[0] ?? 'Parametric'}`;
    return { label, details: details.join('\n') };
  }

  // Color Mixer — identify mode and channel
  if (JSON.stringify(prev.colorMixer) !== JSON.stringify(next.colorMixer)) {
    const details: string[] = [];
    let firstLabel = 'Color Mixer';
    for (const mode of ['hue', 'saturation', 'luminance'] as const) {
      for (const ch of Object.keys(next.colorMixer[mode]) as (keyof typeof next.colorMixer.hue)[]) {
        const pv = prev.colorMixer[mode][ch];
        const nv = next.colorMixer[mode][ch];
        if (pv !== nv) {
          const line = `${HSL_LABELS[ch]} ${MODE_LABELS[mode]} ${fmt(nv)}`;
          details.push(line);
          if (firstLabel === 'Color Mixer') firstLabel = line;
        }
      }
    }
    return { label: firstLabel, details: details.join('\n') };
  }

  // Color Grading — identify which wheel changed
  if (JSON.stringify(prev.colorGrading) !== JSON.stringify(next.colorGrading)) {
    const details: string[] = [];
    for (const range of ['shadows', 'midtones', 'highlights'] as const) {
      const pw = prev.colorGrading[range];
      const nw = next.colorGrading[range];
      if (pw.hue !== nw.hue || pw.sat !== nw.sat) {
        details.push(
          `${range.charAt(0).toUpperCase() + range.slice(1)}: H${Math.round(nw.hue)}° S${(nw.sat * 100).toFixed(0)}%`,
        );
      }
      if (pw.lum !== nw.lum) {
        details.push(`${range.charAt(0).toUpperCase() + range.slice(1)} Lum ${fmt(nw.lum)}`);
      }
    }
    if (prev.colorGrading.blending !== next.colorGrading.blending) {
      details.push(`Blending ${next.colorGrading.blending}`);
    }
    if (prev.colorGrading.balance !== next.colorGrading.balance) {
      details.push(`Balance ${fmt(next.colorGrading.balance)}`);
    }
    const label = details.length > 0 ? `Color Grading — ${details[0]}` : 'Color Grading';
    return { label, details: details.join('\n') };
  }

  // Effects
  const fxChanges: string[] = [];
  for (const key of Object.keys(next.effects) as (keyof typeof next.effects)[]) {
    if (prev.effects[key] !== next.effects[key]) {
      fxChanges.push(`${EFFECTS_LABELS[key] ?? key} ${fmt(next.effects[key])}`);
    }
  }
  if (fxChanges.length > 0) {
    return { label: fxChanges[0], details: fxChanges.join('\n') };
  }

  // Crop
  if (JSON.stringify(prev.crop) !== JSON.stringify(next.crop)) {
    const details: string[] = [];
    if (prev.crop.rotationSteps !== next.crop.rotationSteps) details.push('Rotate 90°');
    if (prev.crop.flipH !== next.crop.flipH) details.push('Flip Horizontal');
    if (prev.crop.flipV !== next.crop.flipV) details.push('Flip Vertical');
    if (prev.crop.rotation !== next.crop.rotation)
      details.push(`Straighten ${fmt(next.crop.rotation)}°`);
    if (JSON.stringify(prev.crop.rect) !== JSON.stringify(next.crop.rect)) {
      const r = next.crop.rect;
      details.push(`Crop ${(r.w * 100).toFixed(0)}% × ${(r.h * 100).toFixed(0)}%`);
    }
    const label = details.length > 0 ? details[0] : 'Crop';
    return { label, details: details.join('\n') };
  }

  // Heal
  if (prev.healSpots.length !== next.healSpots.length) {
    if (next.healSpots.length > prev.healSpots.length) {
      const added = next.healSpots.find((s) => !prev.healSpots.some((p) => p.id === s.id));
      const mode = added?.mode ?? 'heal';
      const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
      const num = next.healSpots.length;
      return { label: `Add ${modeLabel} Spot`, details: `Spot ${num} · ${modeLabel} mode` };
    }
    const removed = prev.healSpots.find((s) => !next.healSpots.some((n) => n.id === s.id));
    const mode = removed?.mode ?? 'heal';
    return {
      label: `Remove ${mode.charAt(0).toUpperCase() + mode.slice(1)} Spot`,
      details: `${next.healSpots.length} spots remaining`,
    };
  }
  if (JSON.stringify(prev.healSpots) !== JSON.stringify(next.healSpots)) {
    const changed = next.healSpots.find(
      (s, i) => JSON.stringify(s) !== JSON.stringify(prev.healSpots[i]),
    );
    const mode = changed?.mode ?? 'heal';
    return {
      label: `Move ${mode.charAt(0).toUpperCase() + mode.slice(1)} Spot`,
      details: `${next.healSpots.length} spots total`,
    };
  }

  // Masks
  if (prev.masks.length !== next.masks.length) {
    if (next.masks.length > prev.masks.length) {
      const added = next.masks.find((m) => !prev.masks.some((p) => p.id === m.id));
      const name = added?.name ?? 'Mask';
      return { label: `Add ${name}`, details: `Type: ${added?.mask.type ?? 'unknown'}` };
    }
    const removed = prev.masks.find((m) => !next.masks.some((n) => n.id === m.id));
    return { label: `Remove ${removed?.name ?? 'Mask'}`, details: '' };
  }
  if (JSON.stringify(prev.masks) !== JSON.stringify(next.masks)) {
    return diffMasks(prev, next);
  }

  return { label: 'Edit', details: '' };
}
