import { getShortcutEntry, formatShortcut } from '@shared/lib/shortcuts';

type ShortcutHintProps = {
  shortcutId: string;
  className?: string;
};

export function ShortcutHint({ shortcutId, className = '' }: ShortcutHintProps) {
  const entry = getShortcutEntry(shortcutId);
  if (!entry) return null;

  return (
    <kbd
      className={`text-[9px] text-br-hint ml-1 tracking-wider font-sans ${className}`}
    >
      {formatShortcut(entry)}
    </kbd>
  );
}
