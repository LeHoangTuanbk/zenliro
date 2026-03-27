import type { ShortcutEntry } from './shortcut-types';

const SYMBOL_MAP: Record<string, string> = {
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
  Enter: '↩',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space',
  '\\': '\\',
  '/': '/',
};

export function formatShortcut(entry: ShortcutEntry): string {
  const parts: string[] = [];

  if (entry.modifiers.meta) parts.push('⌘');
  if (entry.modifiers.shift) parts.push('⇧');
  if (entry.modifiers.alt) parts.push('⌥');

  const keyLabel =
    SYMBOL_MAP[entry.key] ?? entry.key.toUpperCase();

  parts.push(keyLabel);
  return parts.join('');
}
