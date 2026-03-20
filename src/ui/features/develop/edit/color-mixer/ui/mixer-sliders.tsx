import type { ColorMode, HslChannel, ChannelValues } from '../store/types';
import { HSL_CHANNELS, CHANNEL_COLORS } from '../store/types';
import { ClickableValue } from '@/shared/ui/base';

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

// Hue gradients: shifting the channel color toward neighboring hues
const HUE_GRADIENTS: Record<HslChannel, string> = {
  red:     'linear-gradient(to right, #cc44aa, #e05555, #e08833)',
  orange:  'linear-gradient(to right, #e05555, #e08833, #d4cc44)',
  yellow:  'linear-gradient(to right, #e08833, #d4cc44, #55a055)',
  green:   'linear-gradient(to right, #d4cc44, #55a055, #44aabb)',
  aqua:    'linear-gradient(to right, #55a055, #44aabb, #5577e0)',
  blue:    'linear-gradient(to right, #44aabb, #5577e0, #8855cc)',
  purple:  'linear-gradient(to right, #5577e0, #8855cc, #cc55aa)',
  magenta: 'linear-gradient(to right, #8855cc, #cc55aa, #e05555)',
};

// Saturation gradients: gray → channel color
const SAT_GRADIENTS: Record<HslChannel, string> = {
  red:     'linear-gradient(to right, #555, #e05555)',
  orange:  'linear-gradient(to right, #555, #e08833)',
  yellow:  'linear-gradient(to right, #555, #d4cc44)',
  green:   'linear-gradient(to right, #555, #55a055)',
  aqua:    'linear-gradient(to right, #555, #44aabb)',
  blue:    'linear-gradient(to right, #555, #5577e0)',
  purple:  'linear-gradient(to right, #555, #8855cc)',
  magenta: 'linear-gradient(to right, #555, #cc55aa)',
};

// Luminance gradients: dark channel → channel → light channel
const LUM_GRADIENTS: Record<HslChannel, string> = {
  red:     'linear-gradient(to right, #501818, #e05555, #f0b0b0)',
  orange:  'linear-gradient(to right, #503010, #e08833, #f0c890)',
  yellow:  'linear-gradient(to right, #484010, #d4cc44, #eee8a0)',
  green:   'linear-gradient(to right, #1a381a, #55a055, #a0d8a0)',
  aqua:    'linear-gradient(to right, #103838, #44aabb, #90d8e8)',
  blue:    'linear-gradient(to right, #182050, #5577e0, #a0b8f0)',
  purple:  'linear-gradient(to right, #281848, #8855cc, #c0a0e8)',
  magenta: 'linear-gradient(to right, #481838, #cc55aa, #e8a0d0)',
};

const GRADIENTS: Record<ColorMode, Record<HslChannel, string>> = {
  hue: HUE_GRADIENTS,
  saturation: SAT_GRADIENTS,
  luminance: LUM_GRADIENTS,
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
              <ClickableValue
                value={value}
                min={min}
                max={max}
                onChange={(v) => onValueChange(mode, ch, v)}
              />
            </div>
            <div className="relative h-[14px]" onDoubleClick={() => onValueChange(mode, ch, 0)}>
              <div
                className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] rounded-[1.5px]"
                style={{ background: GRADIENTS[mode][ch] }}
              >
                <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2 z-[1]" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-[1.5px] border-white bg-transparent z-[2] shadow-[0_0_2px_rgba(0,0,0,0.6)]"
                  style={{ left: `${pct}%`, marginLeft: -4.5 }}
                />
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
