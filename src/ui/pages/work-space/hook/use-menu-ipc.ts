import { useEffect } from 'react';
import { useShortcutStore } from '@shared/lib/shortcuts';
import { isInputFocused } from '@shared/lib/shortcuts/input-guard';

const MENU_ACTION_TO_SHORTCUT: Record<string, string> = {
  undo: 'global.undo',
  redo: 'global.redo',
  'go-library': 'develop.go-library',
  'go-develop': 'library.go-develop',
  'reset-zoom': 'global.reset-zoom',
  'zoom-in': 'global.zoom-in',
  'zoom-out': 'global.zoom-out',
  'shortcut-menu': 'global.shortcut-menu',
};

const SKIP_INPUT_GUARD = new Set([
  'global.undo',
  'global.redo',
  'global.reset-zoom',
  'global.zoom-in',
  'global.zoom-out',
  'global.shortcut-menu',
]);

type UseMenuIpcParams = {
  onImport: () => void;
  onShowExport: () => void;
};

export function useMenuIpc({ onImport, onShowExport }: UseMenuIpcParams) {
  useEffect(() => {
    const api = window.electron;
    if (!api) return;

    const cleanups = [
      api.onMenuImport(() => onImport()),
      api.onMenuExport(() => onShowExport()),
      api.onMenuAction((action) => {
        const shortcutId = MENU_ACTION_TO_SHORTCUT[action];
        if (!shortcutId) return;
        if (isInputFocused() && !SKIP_INPUT_GUARD.has(shortcutId)) return;
        const handler = useShortcutStore.getState().actions.get(shortcutId);
        handler?.();
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onImport, onShowExport]);
}
