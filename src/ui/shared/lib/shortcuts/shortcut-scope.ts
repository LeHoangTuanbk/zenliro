export const ShortcutScope = {
  Global: 'global',
  Library: 'library',
  Develop: 'develop',
  ToolEdit: 'tool:edit',
  ToolHeal: 'tool:heal',
  ToolCrop: 'tool:crop',
  ToolMask: 'tool:mask',
  Modal: 'modal',
  Compare: 'compare',
} as const;

export type ShortcutScope = (typeof ShortcutScope)[keyof typeof ShortcutScope];

export const SCOPE_PRIORITY: ShortcutScope[] = [
  ShortcutScope.Global,
  ShortcutScope.Library,
  ShortcutScope.Develop,
  ShortcutScope.Compare,
  ShortcutScope.ToolEdit,
  ShortcutScope.ToolHeal,
  ShortcutScope.ToolCrop,
  ShortcutScope.ToolMask,
  ShortcutScope.Modal,
];
