import { useCallback, useRef, useState } from 'react';
import type { Adjustments } from '../store/adjustments-store';
import { DEFAULT_ADJUSTMENTS } from '../store/adjustments-store';
import { clampStep } from '../lib/clamp-step';
import { formatAdjustmentValue } from '@/shared/lib/format/';

type AdjustmentSliderProps = {
  label: string;
  name: keyof Adjustments;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  gradient?: string;
  onChange: (key: keyof Adjustments, value: number) => void;
  onReset: (key: keyof Adjustments) => void;
};

export function AdjustmentSlider({
  label,
  name,
  value,
  min,
  max,
  step = 1,
  onChange,
  onReset,
  decimals,
  gradient,
}: AdjustmentSliderProps) {
  const d = decimals ?? (name === 'exposure' ? 2 : 0);
  const fmt = (v: number) => formatAdjustmentValue(v, d);
  const pct = ((value - min) / (max - min)) * 100;
  const isModified = value !== DEFAULT_ADJUSTMENTS[name];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(
    (raw: string) => {
      const n = parseFloat(raw);
      if (!isNaN(n)) onChange(name, clampStep(n, min, max, step));
      setEditing(false);
    },
    [name, min, max, step, onChange],
  );

  const handleValueClick = useCallback(() => {
    setDraft(fmt(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, d]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(draft);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setEditing(false);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = clampStep(value + step, min, max, step);
        onChange(name, next);
        setDraft(fmt(next));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = clampStep(value - step, min, max, step);
        onChange(name, next);
        setDraft(fmt(next));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, name, value, min, max, step, d, onChange, commit],
  );

  return (
    <div className="flex flex-col gap-0.5 py-[3px]">
      {/* Label + value */}
      <div className="flex justify-between items-baseline">
        <span
          className={`text-[10.5px] cursor-default select-none ${isModified ? 'text-br-text' : 'text-br-muted'}`}
          onDoubleClick={() => onReset(name)}
          title="Double-click to reset"
        >
          {label}
        </span>

        {editing ? (
          <input
            ref={inputRef}
            className={`text-[10px] font-[tabular-nums] w-10 text-right bg-br-elevated border border-br-accent rounded-[2px] px-[3px] outline-none h-4 font-sans ${
              isModified ? 'text-br-warm' : 'text-br-text'
            }`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className={`text-[10px] font-[tabular-nums] min-w-[34px] text-right cursor-text rounded-[2px] px-[2px] py-[1px] hover:bg-br-hover ${
              isModified ? 'text-br-warm' : 'text-br-dim hover:text-br-text'
            }`}
            onClick={handleValueClick}
            title="Click to edit, ↑↓ to step"
          >
            {fmt(value)}
          </span>
        )}
      </div>

      {/* Track */}
      <div className="relative h-[14px] cursor-pointer" onDoubleClick={() => onReset(name)}>
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] rounded-[1.5px] pointer-events-none"
          style={gradient ? { background: gradient } : undefined}
        >
          {!gradient && (
            <div className="absolute inset-0 bg-br-elevated rounded-[1px]" />
          )}
          {/* Center mark */}
          <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2 z-[1]" />
          {/* Fill (only for non-gradient tracks) */}
          {!gradient && value !== 0 && (
            <div
              className="absolute top-0 h-full bg-br-accent opacity-70 rounded-[1px]"
              style={
                value > 0
                  ? { left: '50%', width: `${pct - 50}%` }
                  : { left: `${pct}%`, width: `${50 - pct}%` }
              }
            />
          )}
          {/* Thumb for gradient tracks */}
          {gradient && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-[1.5px] border-white bg-transparent z-[2] shadow-[0_0_2px_rgba(0,0,0,0.6)]"
              style={{ left: `${pct}%`, marginLeft: -4.5 }}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(name, parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>
    </div>
  );
}
