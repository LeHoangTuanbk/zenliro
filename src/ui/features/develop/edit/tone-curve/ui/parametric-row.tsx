import { useCallback, useRef, useState } from 'react';

type ParametricRowProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onActiveChange?: (active: boolean) => void;
};

export function ParametricRow({ label, value, onChange, onActiveChange }: ParametricRowProps) {
  const pct = ((value + 100) / 200) * 100;
  const isModified = value !== 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fmt = (v: number) => (v > 0 ? `+${v}` : String(v));

  const commit = useCallback(
    (raw: string) => {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) onChange(Math.max(-100, Math.min(100, n)));
      setEditing(false);
    },
    [onChange],
  );

  const handleValueClick = useCallback(() => {
    setDraft(fmt(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(draft);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setEditing(false);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(100, value + 1);
        onChange(next);
        setDraft(fmt(next));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(-100, value - 1);
        onChange(next);
        setDraft(fmt(next));
      }
    },
    [draft, value, onChange, commit],
  );

  return (
    <div className="flex flex-col gap-0.5 py-[3px]">
      <div className="flex justify-between items-baseline">
        <span
          className={`text-[10.5px] cursor-default select-none ${isModified ? 'text-br-text' : 'text-br-muted'}`}
          onDoubleClick={() => onChange(0)}
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
            title="Click to edit"
          >
            {fmt(value)}
          </span>
        )}
      </div>

      <div className="relative h-[14px] cursor-pointer" onDoubleClick={() => onChange(0)}>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-br-elevated rounded-[1px]">
          <div className="absolute left-1/2 -top-[1px] w-px h-[5px] bg-br-mark -translate-x-1/2 z-[1]" />
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
          min={-100}
          max={100}
          step={1}
          value={value}
          onMouseDown={() => onActiveChange?.(true)}
          onMouseUp={() => onActiveChange?.(false)}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>
    </div>
  );
}
