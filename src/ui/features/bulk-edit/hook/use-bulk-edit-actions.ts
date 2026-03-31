import { useCallback } from 'react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import { useAgentStore } from '@features/agent/store/agent-store';

export function useBulkEditActions() {
  const startBulkEdit = useCallback(async () => {
    const store = useBulkEditStore.getState();
    if (!store.prompt.trim() || store.selectedPhotoIds.length === 0) return;

    // Determine provider from the selected model
    const models = useAgentStore.getState().models;
    const selectedModel = models.find((m) => m.id === store.modelId);
    const provider = selectedModel?.provider ?? 'claude';

    store.startProcessing();

    await window.electron?.bulkEdit?.start(store.selectedPhotoIds, {
      prompt: store.prompt,
      model: store.modelId,
      provider,
      parallelCount: store.parallelCount,
    });
  }, []);

  const stopBulkEdit = useCallback(() => {
    useBulkEditStore.getState().stopAll();
  }, []);

  return { startBulkEdit, stopBulkEdit };
}
