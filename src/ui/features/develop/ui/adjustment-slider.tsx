import { useCallback, useRef, useState } from 'react';
import type { Adjustments } from '../model/adjustments-store';
import { DEFAULT_ADJUSTMENTS } from '../model/adjustments-store';

interface Props {
  label: string;
  name: keyof Adjustments;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (key: keyof Adjustments, value: number) => void;
  onReset: (key: keyof Adjustments) => void;
}

function fmt(name: keyof Adjustments, v: number) {
  return name === 'exposure' ? v.toFixed(2) : String(Math.round(v));
}

function clampStep(raw: number, min: number, max: number, step: number): number {
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))));
}

export function AdjustmentSlider({ label, name, value, min, max, step = 1, onChange, onReset }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const isModified = value !== DEFAULT_ADJUSTMENTS[name];

  // Local editing state for the input field
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((raw: string) => {
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(name, clampStep(n, min, max, step));
    setEditing(false);
  }, [name, min, max, step, onChange]);

  const handleValueClick = useCallback(() => {
    setDraft(fmt(name, value));
    setEditing(true);
    // Focus on next tick after state update
    setTimeout(() => inputRef.current?.select(), 0);
  }, [name, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(draft);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = clampStep(value + step, min, max, step);
      onChange(name, next);
      setDraft(fmt(name, next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = clampStep(value - step, min, max, step);
      onChange(name, next);
      setDraft(fmt(name, next));
    }
  }, [draft, name, value, min, max, step, onChange, commit]);

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span
          className={`slider-label ${isModified ? 'modified' : ''}`}
          onDoubleClick={() => onReset(name)}
          title="Double-click to reset"
        >
          {label}
        </span>

        {editing ? (
          <input
            ref={inputRef}
            className={`slider-value-input ${isModified ? 'modified' : ''}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className={`slider-value ${isModified ? 'modified' : ''}`}
            onClick={handleValueClick}
            title="Click to edit, ↑↓ to step"
          >
            {fmt(name, value)}
          </span>
        )}
      </div>

      <div className="slider-track-wrap" onDoubleClick={() => onReset(name)}>
        <div className="slider-track">
          <div className="slider-center-mark" />
          {value !== 0 && (
            <div
              className="slider-fill"
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
          step={step}
          value={value}
          onChange={(e) => onChange(name, parseFloat(e.target.value))}
          className="slider-input"
        />
      </div>
    </div>
  );
}
