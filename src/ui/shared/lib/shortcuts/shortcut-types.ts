import type { ShortcutScope } from './shortcut-scope';

export type ShortcutModifiers = {
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutEntry = {
  id: string;
  key: string;
  modifiers: ShortcutModifiers;
  scope: ShortcutScope;
  label: string;
  category: string;
  displayOnly?: boolean;
  skipInputGuard?: boolean;
};

export type ShortcutAction = {
  id: string;
  handler: () => void;
};
