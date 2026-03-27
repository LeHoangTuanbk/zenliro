import { useEffect } from 'react';
import { useShortcutStore } from './shortcut-store';
import type { ShortcutAction } from './shortcut-types';

export function useShortcut(actions: ShortcutAction[]) {
  useEffect(() => {
    if (actions.length === 0) return;
    useShortcutStore.getState().registerActions(actions);
    const ids = actions.map((a) => a.id);
    return () => useShortcutStore.getState().unregisterActions(ids);
  }, [actions]);
}
