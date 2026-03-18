import { useToneCurveStore } from '../store/tone-curve-store';
import type { CurveChannel } from '../store/types';
import { CurveEditor } from './curve-editor';

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
  const { channel, points, parametric, setChannel, setPoints, setParametric, reset } =
    useToneCurveStore();

  const activeColor = CHANNELS.find((c) => c.id === channel)?.color ?? '#ffffff';

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
      <div className="px-3 pb-2">
        <CurveEditor
          points={points[channel]}
          onChange={(pts) => setPoints(channel, pts)}
          color={activeColor}
        />
      </div>

      {/* Parametric sliders */}
      <div className="px-3 pb-2">
        <div className="text-[10px] text-br-dim uppercase tracking-[0.5px] mb-1">Region</div>
        {PARAMETRIC_SLIDERS.map(({ key, label }) => (
          <ParametricRow
            key={key}
            label={label}
            value={parametric[key]}
            onChange={(v) => setParametric(key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function ParametricRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value + 100) / 200) * 100;
  return (
    <div className="flex flex-col gap-0.5 py-[3px]">
      <div className="flex justify-between items-baseline">
        <span className={`text-[10.5px] ${value !== 0 ? 'text-br-text' : 'text-br-muted'}`}>
          {label}
        </span>
        <span
          className={`text-[10px] font-[tabular-nums] min-w-[28px] text-right ${value !== 0 ? 'text-br-warm' : 'text-br-dim'}`}
        >
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div className="relative h-[14px]" onDoubleClick={() => onChange(0)}>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-br-elevated rounded-[1px]">
          <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2" />
          {value !== 0 && (
            <div
              className="absolute top-0 h-full bg-br-accent opacity-70 rounded-[1px]"
              style={
                value > 0
                  ? { left: '50%', width: `${pct - 50}%` }
                  : { left: `${pct}%`, width: `${50 - pct}%` }
              }
            />
          )}
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>
    </div>
  );
}
