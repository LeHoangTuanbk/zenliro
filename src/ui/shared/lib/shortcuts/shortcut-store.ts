import { create } from 'zustand';
import type { ShortcutScope } from './shortcut-scope';
import type { ShortcutAction } from './shortcut-types';

type ShortcutState = {
  activeScopes: ShortcutScope[];
  actions: Map<string, () => void>;
  menuOpen: boolean;
  pushScope: (scope: ShortcutScope) => void;
  popScope: (scope: ShortcutScope) => void;
  replaceScope: (oldScope: ShortcutScope, newScope: ShortcutScope) => void;
  registerActions: (entries: ShortcutAction[]) => void;
  unregisterActions: (ids: string[]) => void;
  setMenuOpen: (open: boolean) => void;
};

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  activeScopes: ['global'],
  actions: new Map(),
  menuOpen: false,

  pushScope: (scope) =>
    set((s) => {
      if (s.activeScopes.includes(scope)) return s;
      return { activeScopes: [...s.activeScopes, scope] };
    }),

  popScope: (scope) =>
    set((s) => ({
      activeScopes: s.activeScopes.filter((sc) => sc !== scope),
    })),

  replaceScope: (oldScope, newScope) =>
    set((s) => ({
      activeScopes: s.activeScopes.map((sc) => (sc === oldScope ? newScope : sc)),
    })),

  registerActions: (entries) => {
    const actions = new Map(get().actions);
    for (const { id, handler } of entries) {
      actions.set(id, handler);
    }
    set({ actions });
  },

  unregisterActions: (ids) => {
    const actions = new Map(get().actions);
    for (const id of ids) {
      actions.delete(id);
    }
    set({ actions });
  },

  setMenuOpen: (open) => set({ menuOpen: open }),
}));
