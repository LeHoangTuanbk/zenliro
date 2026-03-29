import { useMemo, useState } from 'react';
import { useToneCurveStore } from '../store/tone-curve-store';
import type { CurveChannel } from '../store/types';
import { buildParametricOffset } from '../lib/curve-math';
import { CurveEditor } from './curve-editor';
import { ZoneDividers } from './zone-dividers';
import { ParametricRow } from './parametric-row';

const CHANNELS: { id: CurveChannel; label: string; color: string; dot: string }[] = [
  { id: 'rgb', label: 'RGB', color: '#ffffff', dot: '#cccccc' },
  { id: 'r', label: 'R', color: '#e05555', dot: '#e05555' },
  { id: 'g', label: 'G', color: '#55a055', dot: '#55a055' },
  { id: 'b', label: 'B', color: '#5577e0', dot: '#5577e0' },
];

const PARAMETRIC_SLIDERS = [
  { key: 'highlights' as const, label: 'Highlights' },
  { key: 'lights' as const, label: 'Lights' },
  { key: 'darks' as const, label: 'Darks' },
  { key: 'shadows' as const, label: 'Shadows' },
];

export function ToneCurvePanel() {
  const {
    channel,
    points,
    parametric,
    zoneSplits,
    setChannel,
    setPoints,
    setParametric,
    setZoneSplits,
    reset,
  } = useToneCurveStore();

  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const activeColor = CHANNELS.find((c) => c.id === channel)?.color ?? '#ffffff';
  const activeKey = PARAMETRIC_SLIDERS.find((s) => s.label === activeSlider)?.key;
  const channelParametric = parametric[channel];

  const parametricOffset = useMemo(
    () => buildParametricOffset(channelParametric, zoneSplits, points[channel]),
    [channelParametric, zoneSplits, points, channel],
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-br-muted uppercase tracking-[0.6px] font-semibold">
          Tone Curve
        </span>
        <button
          className="border border-br-elevated text-br-muted rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-br-text hover:border-br-mark"
          onClick={reset}
        >
          Reset
        </button>
      </div>

      {/* Channel selector */}
      <div className="flex gap-1 px-3 pb-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold cursor-pointer border transition-colors ${
              channel === ch.id
                ? 'border-br-accent bg-br-elevated text-br-text'
                : 'border-br-elevated bg-transparent text-br-muted hover:text-br-text hover:border-br-mark'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: ch.dot }}
            />
            {ch.label}
          </button>
        ))}
      </div>

      {/* Curve editor */}
      <div className="px-3">
        <CurveEditor
          points={points[channel]}
          onChange={(pts) => setPoints(channel, pts)}
          color={activeColor}
          activeZone={activeSlider}
          activeValue={activeKey ? channelParametric[activeKey] : undefined}
          parametricOffset={parametricOffset}
        />
      </div>

      {/* Zone dividers */}
      <div className="px-3 pb-1">
        <ZoneDividers splits={zoneSplits} onChange={setZoneSplits} />
      </div>

      {/* Parametric sliders */}
      <div className="px-3 pb-2">
        <div className="text-[10px] text-br-dim uppercase tracking-[0.5px] mb-1">Region</div>
        {PARAMETRIC_SLIDERS.map(({ key, label }) => (
          <ParametricRow
            key={key}
            label={label}
            value={channelParametric[key]}
            onChange={(v) => setParametric(channel, key, v)}
            onActiveChange={(active) => setActiveSlider(active ? label : null)}
          />
        ))}
      </div>
    </div>
  );
}
