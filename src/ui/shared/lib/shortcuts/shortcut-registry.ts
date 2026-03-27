import { Key } from './shortcut-key';
import { ShortcutScope } from './shortcut-scope';
import type { ShortcutEntry } from './shortcut-types';

export const SHORTCUT_REGISTRY: ShortcutEntry[] = [
  // ── Global ──
  { id: 'global.undo', key: Key.Z, modifiers: { meta: true }, scope: ShortcutScope.Global, label: 'Undo', category: 'Edit', skipInputGuard: true },
  { id: 'global.redo', key: Key.Z, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Global, label: 'Redo', category: 'Edit', skipInputGuard: true },
  { id: 'global.pan', key: Key.Space, modifiers: {}, scope: ShortcutScope.Global, label: 'Pan Mode', category: 'Navigation', displayOnly: true },
  { id: 'global.reset-zoom', key: Key.Zero, modifiers: { meta: true }, scope: ShortcutScope.Global, label: 'Reset Zoom', category: 'Navigation', skipInputGuard: true },
  { id: 'global.zoom-in', key: Key.Equal, modifiers: { meta: true }, scope: ShortcutScope.Global, label: 'Zoom In', category: 'Navigation', skipInputGuard: true },
  { id: 'global.zoom-out', key: Key.Minus, modifiers: { meta: true }, scope: ShortcutScope.Global, label: 'Zoom Out', category: 'Navigation', skipInputGuard: true },
  { id: 'global.shortcut-menu', key: Key.Slash, modifiers: { meta: true }, scope: ShortcutScope.Global, label: 'Show Shortcuts', category: 'Help', skipInputGuard: true },

  // ── Library ──
  { id: 'library.go-develop', key: Key.D, modifiers: {}, scope: ShortcutScope.Library, label: 'Switch to Develop', category: 'Navigation' },
  { id: 'library.search', key: Key.S, modifiers: { meta: true }, scope: ShortcutScope.Library, label: 'Focus Search', category: 'Library', skipInputGuard: true },
  { id: 'library.delete', key: Key.Backspace, modifiers: {}, scope: ShortcutScope.Library, label: 'Delete Selected', category: 'Library' },
  { id: 'library.deselect', key: Key.Escape, modifiers: {}, scope: ShortcutScope.Library, label: 'Clear Selection', category: 'Library' },
  { id: 'library.select-all', key: Key.A, modifiers: { meta: true }, scope: ShortcutScope.Library, label: 'Select All', category: 'Library', skipInputGuard: true },
  { id: 'library.import', key: Key.I, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Library, label: 'Import Photos', category: 'Library', skipInputGuard: true },
  { id: 'library.rate-1', key: Key.One, modifiers: {}, scope: ShortcutScope.Library, label: 'Set 1 Star', category: 'Rating' },
  { id: 'library.rate-2', key: Key.Two, modifiers: {}, scope: ShortcutScope.Library, label: 'Set 2 Stars', category: 'Rating' },
  { id: 'library.rate-3', key: Key.Three, modifiers: {}, scope: ShortcutScope.Library, label: 'Set 3 Stars', category: 'Rating' },
  { id: 'library.rate-4', key: Key.Four, modifiers: {}, scope: ShortcutScope.Library, label: 'Set 4 Stars', category: 'Rating' },
  { id: 'library.rate-5', key: Key.Five, modifiers: {}, scope: ShortcutScope.Library, label: 'Set 5 Stars', category: 'Rating' },
  { id: 'library.rate-0', key: Key.Zero, modifiers: {}, scope: ShortcutScope.Library, label: 'Clear Rating', category: 'Rating' },

  // ── Develop ──
  { id: 'develop.go-library', key: Key.G, modifiers: {}, scope: ShortcutScope.Develop, label: 'Switch to Library', category: 'Navigation' },
  { id: 'develop.tool-edit', key: Key.E, modifiers: {}, scope: ShortcutScope.Develop, label: 'Edit Tool', category: 'Tools' },
  { id: 'develop.tool-heal', key: Key.Q, modifiers: {}, scope: ShortcutScope.Develop, label: 'Heal Tool', category: 'Tools' },
  { id: 'develop.tool-crop', key: Key.R, modifiers: {}, scope: ShortcutScope.Develop, label: 'Crop Tool', category: 'Tools' },
  { id: 'develop.tool-mask', key: Key.M, modifiers: {}, scope: ShortcutScope.Develop, label: 'Masking Tool', category: 'Tools' },
  { id: 'develop.toggle-compare', key: Key.C, modifiers: {}, scope: ShortcutScope.Develop, label: 'Toggle Compare', category: 'View' },
  { id: 'develop.before-after', key: Key.Backslash, modifiers: {}, scope: ShortcutScope.Develop, label: 'Before / After', category: 'View' },
  { id: 'develop.next-photo', key: Key.ArrowRight, modifiers: {}, scope: ShortcutScope.Develop, label: 'Next Photo', category: 'Navigation' },
  { id: 'develop.prev-photo', key: Key.ArrowLeft, modifiers: {}, scope: ShortcutScope.Develop, label: 'Previous Photo', category: 'Navigation' },
  { id: 'develop.export', key: Key.E, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Develop, label: 'Export Photo', category: 'File', skipInputGuard: true },
  { id: 'develop.copy-settings', key: Key.C, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Develop, label: 'Copy Settings', category: 'Edit', skipInputGuard: true },
  { id: 'develop.paste-settings', key: Key.V, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Develop, label: 'Paste Settings', category: 'Edit', skipInputGuard: true },
  { id: 'develop.reset-all', key: Key.R, modifiers: { meta: true, shift: true }, scope: ShortcutScope.Develop, label: 'Reset All Settings', category: 'Edit', skipInputGuard: true },

  // ── Tool: Heal ──
  { id: 'heal.delete-spot', key: Key.Backspace, modifiers: {}, scope: ShortcutScope.ToolHeal, label: 'Delete Spot', category: 'Heal' },
  { id: 'heal.toggle-preview', key: Key.Backslash, modifiers: {}, scope: ShortcutScope.ToolHeal, label: 'Toggle Preview', category: 'Heal' },

  // ── Tool: Crop ──
  { id: 'crop.reset', key: Key.Escape, modifiers: {}, scope: ShortcutScope.ToolCrop, label: 'Reset Crop', category: 'Crop' },
  { id: 'crop.commit', key: Key.Enter, modifiers: {}, scope: ShortcutScope.ToolCrop, label: 'Apply Crop', category: 'Crop' },
  { id: 'crop.toggle-lock', key: Key.A, modifiers: {}, scope: ShortcutScope.ToolCrop, label: 'Toggle Aspect Lock', category: 'Crop' },

  // ── Tool: Mask ──
  { id: 'mask.delete', key: Key.Backspace, modifiers: {}, scope: ShortcutScope.ToolMask, label: 'Delete Mask', category: 'Mask' },
  { id: 'mask.invert', key: Key.I, modifiers: {}, scope: ShortcutScope.ToolMask, label: 'Invert Mask', category: 'Mask' },
  { id: 'mask.toggle-overlay', key: Key.O, modifiers: {}, scope: ShortcutScope.ToolMask, label: 'Toggle Overlay', category: 'Mask' },
];

export function getShortcutEntry(id: string): ShortcutEntry | undefined {
  return SHORTCUT_REGISTRY.find((e) => e.id === id);
}
