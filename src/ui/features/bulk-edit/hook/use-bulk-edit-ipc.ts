import { useEffect } from 'react';
import { useBulkEditStore } from '../store/bulk-edit-store';
import type { JobStatus } from '../const/channels';

export function useBulkEditIpc() {
  useEffect(() => {
    const api = window.electron?.bulkEdit;
    if (!api) return;

    const store = useBulkEditStore.getState;

    const cleanups = [
      api.onJobStatus((data) => {
        store().updateJobStatus(data.photoId, data.status as JobStatus, data.agentIndex);
      }),
      api.onJobThinking((data) => {
        store().updateJobThinking(data.photoId, data.text);
      }),
      api.onJobText((data) => {
        // Show agent text output as thinking fallback (most visible agent activity)
        store().updateJobThinking(data.photoId, data.text);
      }),
      api.onJobToolUse((data) => {
        store().updateJobToolUse(data.photoId, data.name);
      }),
      api.onJobError((_data) => {
        // Error status already handled by onJobStatus
      }),
      api.onAllDone((summary) => {
        store().setAllDone(summary);
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}
