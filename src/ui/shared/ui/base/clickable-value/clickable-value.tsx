import { useState, useRef, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';

type Props = {
  value: number;
  min: number;
  max: number;
  decimals?: number;
  className?: string;
  onChange: (v: number) => void;
};

function fmt(v: number, decimals: number) {
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

export function ClickableValue({ value, min, max, decimals = 0, className, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(fmt(value, decimals));
    setEditing(true);
    // Focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, decimals > 0 ? parsed : Math.round(parsed))));
    }
    setEditing(false);
  }, [draft, min, max, decimals, onChange]);

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
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
      title="Click to enter value"
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
