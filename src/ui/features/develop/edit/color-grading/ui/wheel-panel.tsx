import { ColorWheel } from './color-wheel';
import type { WheelState, GradingRange } from '../store/types';

type Props = {
  label: string;
  range: GradingRange;
  wheel: WheelState;
  size: number;
  onChange: (range: GradingRange, patch: Partial<WheelState>) => void;
  onReset: (range: GradingRange) => void;
};

export function WheelPanel({ label, range, wheel, size, onChange, onReset }: Props) {
  const isModified = wheel.sat > 0.01 || wheel.lum !== 0;
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size + 32 }}>
      {/* Label row */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[9px] text-br-dim uppercase tracking-[0.5px]">{label}</span>
        {isModified && (
          <button
            onClick={() => onReset(range)}
            className="text-[10px] text-br-dim hover:text-br-muted cursor-pointer leading-none"
            title="Reset"
          >
            ↺
          </button>
        )}
      </div>
      {/* Wheel */}
      <ColorWheel
        hue={wheel.hue}
        sat={wheel.sat}
        size={size}
        onChange={(hue, sat) => onChange(range, { hue, sat })}
      />
      {/* Luminance slider */}
      <div className="flex items-center gap-1 w-full">
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={wheel.lum}
          onChange={(e) => onChange(range, { lum: parseInt(e.target.value, 10) })}
          className="flex-1 h-[3px] cursor-pointer min-w-0"
          style={{ accentColor: 'var(--color-br-accent)' }}
          onDoubleClick={() => onChange(range, { lum: 0 })}
        />
        <span className="text-[9px] text-br-dim w-5 text-right tabular-nums flex-shrink-0">
          {wheel.lum > 0 ? `+${wheel.lum}` : wheel.lum}
        </span>
      </div>
    </div>
  );
}
