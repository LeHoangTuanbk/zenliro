import { useState, useRef, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { Key } from '@/shared/lib/shortcuts/shortcut-key';

type Props = {
  value: number;
  min: number;
  max: number;
  decimals?: number;
  step?: number;
  className?: string;
  onChange: (v: number) => void;
};

const SHIFT_STEP_MULT = 10;

function fmt(v: number, decimals: number) {
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function resolveStep(step: number | undefined, decimals: number) {
  if (step !== undefined) return step;
  return decimals > 0 ? 10 ** -decimals : 1;
}

function clampStep(raw: number, min: number, max: number, step: number) {
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))));
}

export function ClickableValue({
  value,
  min,
  max,
  decimals = 0,
  step: stepProp,
  className,
  onChange,
}: Props) {
  const step = resolveStep(stepProp, decimals);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(fmt(value, decimals));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(clampStep(parsed, min, max, step));
    }
    setEditing(false);
  }, [draft, min, max, step, onChange]);

  const cancel = () => setEditing(false);

  const nudge = useCallback(
    (dir: 1 | -1, large: boolean) => {
      const delta = step * (large ? SHIFT_STEP_MULT : 1) * dir;
      const next = clampStep(value + delta, min, max, step);
      onChange(next);
      setDraft(fmt(next, decimals));
    },
    [value, min, max, step, decimals, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === Key.Enter) {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === Key.Escape) {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === Key.ArrowUp) {
      e.preventDefault();
      nudge(1, e.shiftKey);
      return;
    }
    if (e.key === Key.ArrowDown) {
      e.preventDefault();
      nudge(-1, e.shiftKey);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          'bg-br-input border border-br-accent rounded-[2px] text-br-text text-right outline-none tabular-nums',
          'w-[34px] h-[16px] text-[10px] px-0.5',
          className,
        )}
      />
    );
  }

  const display = fmt(value, decimals);
  const isModified = value !== 0;

  return (
    <span
      onClick={startEdit}
      title="Click to edit, ↑↓ to step"
      className={cn(
        'tabular-nums cursor-text select-none text-[10px] text-right w-[34px] flex-shrink-0',
        isModified ? 'text-br-warm' : 'text-br-dim',
        'hover:text-br-text hover:underline decoration-dotted underline-offset-2',
        className,
      )}
    >
      {Number(display) > 0 && min < 0 ? `+${display}` : display}
    </span>
  );
}
