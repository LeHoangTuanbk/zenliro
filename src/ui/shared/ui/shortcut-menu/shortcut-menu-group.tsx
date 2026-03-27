import { formatShortcut } from '@shared/lib/shortcuts';
import type { ShortcutEntry } from '@shared/lib/shortcuts';

type ShortcutMenuGroupProps = {
  title: string;
  entries: ShortcutEntry[];
};

export function ShortcutMenuGroup({ title, entries }: ShortcutMenuGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="text-[10px] font-semibold text-br-muted uppercase tracking-[0.8px] mb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between px-2 py-1 rounded-[2px] hover:bg-br-input"
          >
            <span className="text-[11px] text-br-text-hover">{entry.label}</span>
            <kbd className="text-[11px] text-br-muted font-mono bg-br-bg border border-br-hover px-1.5 py-0.5 rounded-[2px] min-w-[24px] text-center">
              {formatShortcut(entry)}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
