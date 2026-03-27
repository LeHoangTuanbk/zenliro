import { useEffect, useRef } from 'react';
import type { ActiveView } from '@pages/work-space/const/active-view';
import type { ActiveTool } from '@features/develop/const/active-tool';
import { ShortcutScope } from './shortcut-scope';
import { useShortcutStore } from './shortcut-store';

const VIEW_TO_SCOPE: Record<ActiveView, ShortcutScope> = {
  library: ShortcutScope.Library,
  develop: ShortcutScope.Develop,
};

const TOOL_TO_SCOPE: Record<ActiveTool, ShortcutScope> = {
  edit: ShortcutScope.ToolEdit,
  heal: ShortcutScope.ToolHeal,
  crop: ShortcutScope.ToolCrop,
  mask: ShortcutScope.ToolMask,
};

export function useScopeSync(activeView: ActiveView, activeTool: ActiveTool) {
  const prevViewRef = useRef<ActiveView | null>(null);
  const prevToolRef = useRef<ActiveTool | null>(null);

  useEffect(() => {
    const store = useShortcutStore.getState();
    const prevView = prevViewRef.current;

    if (prevView && prevView !== activeView) {
      store.popScope(VIEW_TO_SCOPE[prevView]);
    }
    store.pushScope(VIEW_TO_SCOPE[activeView]);
    prevViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    const store = useShortcutStore.getState();
    const prevTool = prevToolRef.current;

    if (prevTool && prevTool !== activeTool) {
      store.popScope(TOOL_TO_SCOPE[prevTool]);
    }
    if (activeView === 'develop') {
      store.pushScope(TOOL_TO_SCOPE[activeTool]);
    }
    prevToolRef.current = activeTool;
  }, [activeTool, activeView]);
}
