import type { ColorMode, HslChannel, ChannelValues } from '../store/types';
import { HSL_CHANNELS, CHANNEL_COLORS } from '../store/types';

type Props = {
  mode: ColorMode;
  values: ChannelValues;
  onValueChange: (mode: ColorMode, ch: HslChannel, v: number) => void;
};

const RANGE: Record<ColorMode, { min: number; max: number }> = {
  hue: { min: -180, max: 180 },
  saturation: { min: -100, max: 100 },
  luminance: { min: -100, max: 100 },
};

const MODE_LABELS: Record<ColorMode, string> = {
  hue: 'Hue',
  saturation: 'Saturation',
  luminance: 'Luminance',
};

export function MixerSliders({ mode, values, onValueChange }: Props) {
  const { min, max } = RANGE[mode];

  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-br-dim uppercase tracking-[0.5px] px-3 py-1">
        {MODE_LABELS[mode]}
      </div>
      {HSL_CHANNELS.map((ch) => {
        const value = values[ch];
        const range = max - min;
        const pct = ((value - min) / range) * 100;
        const isModified = value !== 0;
        return (
          <div key={ch} className="flex flex-col gap-0.5 px-3 py-[3px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHANNEL_COLORS[ch] }}
                />
                <span
                  className={`text-[10.5px] capitalize ${isModified ? 'text-br-text' : 'text-br-muted'}`}
                >
                  {ch}
                </span>
              </div>
              <span
                className={`text-[10px] font-[tabular-nums] min-w-[32px] text-right ${isModified ? 'text-br-warm' : 'text-br-dim'}`}
              >
                {value > 0 ? `+${value}` : value}
              </span>
            </div>
            <div className="relative h-[14px]" onDoubleClick={() => onValueChange(mode, ch, 0)}>
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-br-elevated rounded-[1px]">
                <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2" />
                {isModified && (
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
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onValueChange(mode, ch, parseInt(e.target.value, 10))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
