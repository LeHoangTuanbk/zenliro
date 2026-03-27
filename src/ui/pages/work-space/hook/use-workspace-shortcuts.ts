import { useCallback, useMemo } from 'react';
import { ActiveTool } from '@features/develop/const';
import { ActiveView } from '../const/active-view';
import { useShortcut, useShortcutStore } from '@shared/lib/shortcuts';
import { useCompareStore } from '@features/develop/compare/compare-store';
import type { ImportedPhoto } from '../store/photo-store';
import type { ShortcutAction } from '@shared/lib/shortcuts';

type UseWorkspaceShortcutsParams = {
  activeView: ActiveView;
  activeTool: ActiveTool;
  photos: ImportedPhoto[];
  selectedId: string | null;
  setActiveView: (view: ActiveView) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedId: (id: string) => void;
  setShowExport: (show: boolean) => void;
  handleImport: () => void;
  handleRatingChange: (id: string, rating: number) => void;
};

export function useWorkspaceShortcuts({
  activeView,
  photos,
  selectedId,
  setActiveView,
  setActiveTool,
  setSelectedId,
  setShowExport,
  handleImport,
  handleRatingChange,
}: UseWorkspaceShortcutsParams) {
  const toggleCompare = useCompareStore((s) => s.toggle);

  // ── Navigation ──
  const goLibrary = useCallback(() => setActiveView(ActiveView.Library), [setActiveView]);
  const goDevelop = useCallback(() => {
    if (selectedId) setActiveView(ActiveView.Develop);
  }, [setActiveView, selectedId]);

  // ── Photo navigation ──
  const navigatePhoto = useCallback(
    (dir: 1 | -1) => {
      if (photos.length === 0) return;
      const idx = photos.findIndex((p) => p.id === selectedId);
      const next = idx + dir;
      if (next >= 0 && next < photos.length) setSelectedId(photos[next].id);
    },
    [photos, selectedId, setSelectedId],
  );
  const nextPhoto = useCallback(() => navigatePhoto(1), [navigatePhoto]);
  const prevPhoto = useCallback(() => navigatePhoto(-1), [navigatePhoto]);

  // ── Tools ──
  const toolEdit = useCallback(() => setActiveTool(ActiveTool.Edit), [setActiveTool]);
  const toolHeal = useCallback(() => setActiveTool(ActiveTool.Heal), [setActiveTool]);
  const toolCrop = useCallback(() => setActiveTool(ActiveTool.Crop), [setActiveTool]);
  const toolMask = useCallback(() => setActiveTool(ActiveTool.Mask), [setActiveTool]);

  // ── Export ──
  const showExport = useCallback(() => setShowExport(true), [setShowExport]);

  // ── Shortcut menu ──
  const toggleMenu = useCallback(() => {
    const store = useShortcutStore.getState();
    store.setMenuOpen(!store.menuOpen);
  }, []);

  // ── Rating ──
  const rate = useCallback(
    (n: number) => {
      if (selectedId) handleRatingChange(selectedId, n);
    },
    [selectedId, handleRatingChange],
  );

  const actions = useMemo<ShortcutAction[]>(() => {
    const base: ShortcutAction[] = [
      { id: 'global.shortcut-menu', handler: toggleMenu },
    ];

    if (activeView === 'library') {
      base.push(
        { id: 'library.go-develop', handler: goDevelop },
        { id: 'library.import', handler: handleImport },
        { id: 'library.rate-1', handler: () => rate(1) },
        { id: 'library.rate-2', handler: () => rate(2) },
        { id: 'library.rate-3', handler: () => rate(3) },
        { id: 'library.rate-4', handler: () => rate(4) },
        { id: 'library.rate-5', handler: () => rate(5) },
        { id: 'library.rate-0', handler: () => rate(0) },
      );
    }

    if (activeView === 'develop') {
      base.push(
        { id: 'develop.go-library', handler: goLibrary },
        { id: 'develop.tool-edit', handler: toolEdit },
        { id: 'develop.tool-heal', handler: toolHeal },
        { id: 'develop.tool-crop', handler: toolCrop },
        { id: 'develop.tool-mask', handler: toolMask },
        { id: 'develop.toggle-compare', handler: toggleCompare },
        { id: 'develop.before-after', handler: toggleCompare },
        { id: 'develop.next-photo', handler: nextPhoto },
        { id: 'develop.prev-photo', handler: prevPhoto },
        { id: 'develop.export', handler: showExport },
      );
    }

    return base;
  }, [
    activeView, toggleMenu, goDevelop, goLibrary, handleImport,
    rate, toolEdit, toolHeal, toolCrop, toolMask,
    toggleCompare, nextPhoto, prevPhoto, showExport,
  ]);

  useShortcut(actions);
}
