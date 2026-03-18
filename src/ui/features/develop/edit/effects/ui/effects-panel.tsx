import { useEffectsStore } from '../model/effects-store';
import { BrButton, ClickableValue } from '@/shared/ui/base';

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
};

function SliderRow({ label, value, min, max, onChange, onDoubleClick }: SliderRowProps) {
  const isModified = value !== 0 && !(min === 0 && value === 0);
  return (
    <div className="flex items-center gap-2 px-3 py-[3px] hover:bg-br-hover">
      <span className="w-[80px] flex-shrink-0 text-right text-[10.5px] text-br-muted">{label}</span>
      <div className="relative flex-1 h-[14px]" onDoubleClick={onDoubleClick}>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-br-elevated rounded-[1px]">
          {min < 0 && (
            <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2" />
          )}
          {isModified && min < 0 && (
            <div
              className="absolute top-0 h-full bg-br-accent opacity-70 rounded-[1px]"
              style={
                value > 0
                  ? { left: '50%', width: `${((value - 0) / (max - 0)) * 50}%` }
                  : { left: `${50 + (value / (min - 0)) * -50}%`, width: `${(Math.abs(value) / Math.abs(min)) * 50}%` }
              }
            />
          )}
          {isModified && min >= 0 && (
            <div
              className="absolute top-0 left-0 h-full bg-br-accent opacity-70 rounded-[1px]"
              style={{ width: `${((value - min) / (max - min)) * 100}%` }}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>
      <ClickableValue value={value} min={min} max={max} onChange={onChange} />
    </div>
  );
}

export function EffectsPanel() {
  const store = useEffectsStore();
  const hasVignette = store.vigAmount !== 0;
  const hasGrain = store.grainAmount !== 0;
  const isModified = hasVignette || hasGrain;

  return (
    <div className="flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-br-muted uppercase tracking-[0.6px] font-semibold">
          Effects
        </span>
        {isModified && (
          <BrButton onClick={store.reset}>Reset</BrButton>
        )}
      </div>

      {/* Post-Crop Vignetting */}
      <div className="pb-1">
        <div className="px-3 pb-1">
          <span className="text-[10px] text-br-dim uppercase tracking-[0.5px]">
            Post-Crop Vignetting
          </span>
        </div>
        <SliderRow
          label="Amount"
          value={store.vigAmount}
          min={-100}
          max={100}
          onChange={(v) => store.set('vigAmount', v)}
          onDoubleClick={() => store.set('vigAmount', 0)}
        />
        <SliderRow
          label="Midpoint"
          value={store.vigMidpoint}
          min={0}
          max={100}
          onChange={(v) => store.set('vigMidpoint', v)}
          onDoubleClick={() => store.set('vigMidpoint', 50)}
        />
        <SliderRow
          label="Roundness"
          value={store.vigRoundness}
          min={-100}
          max={100}
          onChange={(v) => store.set('vigRoundness', v)}
          onDoubleClick={() => store.set('vigRoundness', 0)}
        />
        <SliderRow
          label="Feather"
          value={store.vigFeather}
          min={0}
          max={100}
          onChange={(v) => store.set('vigFeather', v)}
          onDoubleClick={() => store.set('vigFeather', 50)}
        />
        <SliderRow
          label="Highlights"
          value={store.vigHighlights}
          min={0}
          max={100}
          onChange={(v) => store.set('vigHighlights', v)}
          onDoubleClick={() => store.set('vigHighlights', 0)}
        />
      </div>

      {/* Grain */}
      <div className="border-t border-br-elevated pt-1 pb-2">
        <div className="px-3 pb-1">
          <span className="text-[10px] text-br-dim uppercase tracking-[0.5px]">Grain</span>
        </div>
        <SliderRow
          label="Amount"
          value={store.grainAmount}
          min={0}
          max={100}
          onChange={(v) => store.set('grainAmount', v)}
          onDoubleClick={() => store.set('grainAmount', 0)}
        />
        <SliderRow
          label="Size"
          value={store.grainSize}
          min={0}
          max={100}
          onChange={(v) => store.set('grainSize', v)}
          onDoubleClick={() => store.set('grainSize', 25)}
        />
        <SliderRow
          label="Roughness"
          value={store.grainRoughness}
          min={0}
          max={100}
          onChange={(v) => store.set('grainRoughness', v)}
          onDoubleClick={() => store.set('grainRoughness', 50)}
        />
      </div>
    </div>
  );
}
