import { useState } from 'react';
import { useColorGradingStore } from '../store/color-grading-store';
import { WheelPanel } from './wheel-panel';
import type { GradingRange, WheelState } from '../store/types';
import { defaultWheel } from '../store/types';

type ViewMode = 'all' | 'midtones' | 'shadows' | 'highlights';

const VIEW_MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: 'all', label: '⊞', title: 'All' },
  { id: 'shadows', label: '◐', title: 'Shadows' },
  { id: 'midtones', label: '◑', title: 'Midtones' },
  { id: 'highlights', label: '◕', title: 'Highlights' },
];

const BIG = 96;
const SMALL = 72;

export function ColorGradingPanel() {
  const {
    shadows,
    midtones,
    highlights,
    blending,
    balance,
    setWheel,
    setBlending,
    setBalance,
    reset,
  } = useColorGradingStore();
  const [view, setView] = useState<ViewMode>('all');

  const handleChange = (range: GradingRange, patch: Partial<WheelState>) => setWheel(range, patch);
  const handleReset = (range: GradingRange) => setWheel(range, defaultWheel());

  return (
    <div className="flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-0.5">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setView(m.id)}
              title={m.title}
              className={`w-6 h-6 text-[12px] rounded-[2px] border cursor-pointer transition-colors flex items-center justify-center ${
                view === m.id
                  ? 'border-br-accent text-br-text bg-br-elevated'
                  : 'border-br-elevated text-br-dim hover:text-br-muted hover:border-br-mark'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          className="border border-br-elevated text-br-muted rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-br-text hover:border-br-mark transition-colors"
          onClick={reset}
        >
          Reset
        </button>
      </div>

      {/* Wheels */}
      <div className="flex flex-col items-center gap-3 px-3 pb-2">
        {view === 'all' ? (
          <>
            {/* Midtones — centered, larger */}
            <WheelPanel
              label="Midtones"
              range="midtones"
              wheel={midtones}
              size={BIG}
              onChange={handleChange}
              onReset={handleReset}
            />
            {/* Shadows + Highlights — equal columns */}
            <div className="flex w-full justify-around">
              <WheelPanel
                label="Shadows"
                range="shadows"
                wheel={shadows}
                size={SMALL}
                onChange={handleChange}
                onReset={handleReset}
              />
              <WheelPanel
                label="Highlights"
                range="highlights"
                wheel={highlights}
                size={SMALL}
                onChange={handleChange}
                onReset={handleReset}
              />
            </div>
          </>
        ) : (
          <WheelPanel
            label={view.charAt(0).toUpperCase() + view.slice(1)}
            range={view}
            wheel={view === 'shadows' ? shadows : view === 'midtones' ? midtones : highlights}
            size={BIG}
            onChange={handleChange}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Blending & Balance */}
      <div className="flex flex-col gap-1.5 px-3 pt-2 pb-3 border-t border-br-elevated">
        {(
          [
            { label: 'Blending', value: blending, min: 0, max: 100, def: 50, fn: setBlending },
            { label: 'Balance', value: balance, min: -100, max: 100, def: 0, fn: setBalance },
          ] as const
        ).map(({ label, value, min, max, def, fn }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[10px] text-br-muted w-[50px] flex-shrink-0">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={value}
              onChange={(e) => fn(parseInt(e.target.value, 10))}
              onDoubleClick={() => fn(def)}
              className="flex-1 h-[3px] cursor-pointer min-w-0"
              style={{ accentColor: 'var(--color-br-accent)' }}
            />
            <span className="text-[10px] text-br-dim w-7 text-right tabular-nums flex-shrink-0">
              {value > 0 ? `+${value}` : value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
