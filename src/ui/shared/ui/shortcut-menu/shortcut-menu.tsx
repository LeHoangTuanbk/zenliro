import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SHORTCUT_REGISTRY, useShortcutStore } from '@shared/lib/shortcuts';
import { ShortcutMenuGroup } from './shortcut-menu-group';

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  library: 'Library',
  develop: 'Develop',
  'tool:edit': 'Edit Tool',
  'tool:heal': 'Heal Tool',
  'tool:crop': 'Crop Tool',
  'tool:mask': 'Mask Tool',
};

type ShortcutMenuPanelProps = {
  onClose: () => void;
};

function ShortcutMenuPanel({ onClose }: ShortcutMenuPanelProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  const grouped = useMemo(() => {
    const filtered = search
      ? SHORTCUT_REGISTRY.filter(
          (e) =>
            e.label.toLowerCase().includes(search.toLowerCase()) ||
            e.category.toLowerCase().includes(search.toLowerCase()),
        )
      : SHORTCUT_REGISTRY;

    const groups = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const key = entry.scope;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return groups;
  }, [search]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-h-[70vh] bg-br-surface border border-br-elevated rounded-[4px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-br-elevated">
          <h2 className="text-[12px] font-semibold text-br-text uppercase tracking-[1px]">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-br-muted hover:text-br-text cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-br-elevated">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search shortcuts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1 text-[11px] bg-br-bg-deep border border-br-elevated rounded-[2px] text-br-text outline-none focus:border-br-accent placeholder:text-br-dim"
          />
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {[...grouped.entries()].map(([scope, entries]) => (
            <ShortcutMenuGroup key={scope} title={SCOPE_LABELS[scope] ?? scope} entries={entries} />
          ))}
          {grouped.size === 0 && (
            <p className="text-center text-[11px] text-br-dim py-8">No shortcuts found</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-br-elevated text-[9px] text-br-dim text-center">
          Press ⌘/ to toggle this menu
        </div>
      </div>
    </div>
  );
}

export function ShortcutMenu() {
  const menuOpen = useShortcutStore((s) => s.menuOpen);
  const setMenuOpen = useShortcutStore((s) => s.setMenuOpen);
  const onClose = useCallback(() => setMenuOpen(false), [setMenuOpen]);

  if (!menuOpen) return null;

  return <ShortcutMenuPanel onClose={onClose} />;
}
