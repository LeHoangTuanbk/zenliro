import { useCallback } from 'react';
import { useBulkEditStore } from '../store/bulk-edit-store';

export function useBulkEditActions() {
  const startBulkEdit = useCallback(async () => {
    const store = useBulkEditStore.getState();
    if (!store.prompt.trim() || store.selectedPhotoIds.length === 0) return;

    store.startProcessing();

    await window.electron?.bulkEdit?.start(store.selectedPhotoIds, {
      prompt: store.prompt,
      model: store.modelId,
      parallelCount: store.parallelCount,
    });
  }, []);

  const stopBulkEdit = useCallback(() => {
    useBulkEditStore.getState().stopAll();
  }, []);

  return { startBulkEdit, stopBulkEdit };
}
