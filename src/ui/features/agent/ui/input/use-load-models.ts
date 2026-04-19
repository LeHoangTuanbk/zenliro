import { useEffect } from 'react';
import { useAgentStore } from '../../store/agent-store';

// Pull the dynamic model list from the main process once per session. Before
// this resolves, the store holds DEFAULT_MODELS so the UI stays functional.
export function useLoadModels() {
  const modelsLoaded = useAgentStore((s) => s.modelsLoaded);
  const loadModelsAction = useAgentStore((s) => s.loadModels);

  useEffect(() => {
    if (modelsLoaded) return;
    window.electron?.agent?.loadModels().then((loaded) => {
      if (!loaded || loaded.length === 0) return;
      loadModelsAction(
        loaded.map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
          provider: m.provider as 'claude' | 'codex',
        })),
      );
    });
  }, [modelsLoaded, loadModelsAction]);
}
