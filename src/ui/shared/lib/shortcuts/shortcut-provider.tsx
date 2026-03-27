import { useEffect } from 'react';
import { SHORTCUT_REGISTRY } from './shortcut-registry';
import { useShortcutStore } from './shortcut-store';
import { SCOPE_PRIORITY } from './shortcut-scope';
import { isInputFocused } from './input-guard';
import type { ShortcutEntry } from './shortcut-types';

function matchesEvent(entry: ShortcutEntry, e: KeyboardEvent): boolean {
  if (!entry.key) return false;
  const keyMatch = e.key.toLowerCase() === entry.key.toLowerCase();
  const metaMatch = !!entry.modifiers.meta === e.metaKey;
  const shiftMatch = !!entry.modifiers.shift === e.shiftKey;
  const altMatch = !!entry.modifiers.alt === e.altKey;
  return keyMatch && metaMatch && shiftMatch && altMatch;
}

function hasModifier(entry: ShortcutEntry): boolean {
  return !!entry.modifiers.meta || !!entry.modifiers.alt;
}

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { activeScopes, actions } = useShortcutStore.getState();
      const inputFocused = isInputFocused();

      const sortedScopes = [...activeScopes].sort(
        (a, b) => SCOPE_PRIORITY.indexOf(b) - SCOPE_PRIORITY.indexOf(a),
      );

      for (const scope of sortedScopes) {
        const candidates = SHORTCUT_REGISTRY.filter(
          (entry) => entry.scope === scope && !entry.displayOnly,
        );

        for (const entry of candidates) {
          if (!matchesEvent(entry, e)) continue;
          if (inputFocused && !entry.skipInputGuard && !hasModifier(entry)) continue;

          const handler = actions.get(entry.id);
          if (handler) {
            e.preventDefault();
            e.stopPropagation();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <>{children}</>;
}
