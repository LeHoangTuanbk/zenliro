import { useCallback, useMemo } from 'react';
import { ActiveTool } from '@features/develop/const';
import { ActiveView } from '../const/active-view';
import { useShortcut, useShortcutStore } from '@shared/lib/shortcuts';
import { useCompareStore } from '@features/develop/compare/compare-store';
import { useAgentStore } from '@/features/agent/store/agent-store';
import type { ShortcutAction } from '@shared/lib/shortcuts';

const LIBRARY_GRID_SELECTOR = '[data-library-grid]';

function scrollToPhoto(photoId: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-photo-id="${photoId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function getGridColumnCount(): number {
  const grid = document.querySelector(LIBRARY_GRID_SELECTOR);
  if (!grid) return 1;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  return Math.max(cols, 1);
}

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
  handleOpenDevelop: (id: string) => void;
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
  handleOpenDevelop,
}: UseWorkspaceShortcutsParams) {
  const toggleCompare = useCompareStore((s) => s.toggle);
  const toggleAgent = useAgentStore((s) => s.toggle);

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

  // ── Library grid navigation ──
  const navigateGrid = useCallback(
    (offset: number) => {
      if (photos.length === 0) return;
      const idx = photos.findIndex((p) => p.id === selectedId);
      if (idx === -1) {
        setSelectedId(photos[0].id);
        scrollToPhoto(photos[0].id);
        return;
      }
      const next = idx + offset;
      if (next >= 0 && next < photos.length) {
        setSelectedId(photos[next].id);
        scrollToPhoto(photos[next].id);
      }
    },
    [photos, selectedId, setSelectedId],
  );
  const navLeft = useCallback(() => navigateGrid(-1), [navigateGrid]);
  const navRight = useCallback(() => navigateGrid(1), [navigateGrid]);
  const navUp = useCallback(() => navigateGrid(-getGridColumnCount()), [navigateGrid]);
  const navDown = useCallback(() => navigateGrid(getGridColumnCount()), [navigateGrid]);
  const openDevelop = useCallback(() => {
    if (selectedId) handleOpenDevelop(selectedId);
  }, [selectedId, handleOpenDevelop]);

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
    const base: ShortcutAction[] = [{ id: 'global.shortcut-menu', handler: toggleMenu }];

    if (activeView === 'library') {
      base.push(
        { id: 'library.go-develop', handler: goDevelop },
        { id: 'library.import', handler: handleImport },
        { id: 'library.nav-left', handler: navLeft },
        { id: 'library.nav-right', handler: navRight },
        { id: 'library.nav-up', handler: navUp },
        { id: 'library.nav-down', handler: navDown },
        { id: 'library.open-develop', handler: openDevelop },
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
        { id: 'develop.toggle-agent', handler: toggleAgent },
      );
    }

    return base;
  }, [
    activeView,
    toggleMenu,
    goDevelop,
    goLibrary,
    handleImport,
    navLeft,
    navRight,
    navUp,
    navDown,
    openDevelop,
    rate,
    toolEdit,
    toolHeal,
    toolCrop,
    toolMask,
    toggleCompare,
    nextPhoto,
    prevPhoto,
    showExport,
    toggleAgent,
  ]);

  useShortcut(actions);
}
