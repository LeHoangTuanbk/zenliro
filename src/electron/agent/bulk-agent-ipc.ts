import { BrowserWindow, ipcMain, Notification, app } from 'electron';
import { BulkAgentManager } from './bulk-agent-manager.js';
import type { BulkJobEvent } from './bulk-agent-manager.js';
import { createLogger } from '../logger/index.js';

const log = createLogger('main/bulk-agent-ipc');

export const BULK_CHANNELS = {
  START: 'bulk-edit:start',
  STOP: 'bulk-edit:stop',
  STOP_JOB: 'bulk-edit:stop-job',
  GET_STATUS: 'bulk-edit:get-status',
  // Events from main → renderer
  JOB_STATUS: 'bulk-edit:job-status',
  JOB_THINKING: 'bulk-edit:job-thinking',
  JOB_TEXT: 'bulk-edit:job-text',
  JOB_TOOL_USE: 'bulk-edit:job-tool-use',
  JOB_ERROR: 'bulk-edit:job-error',
  ALL_DONE: 'bulk-edit:all-done',
} as const;

let manager: BulkAgentManager | null = null;

export function registerBulkAgentIpc(mainWindow: BrowserWindow) {
  const send = (channel: string, data?: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  const handleBulkEvent = (event: BulkJobEvent) => {
    switch (event.type) {
      case 'job-status':
        send(BULK_CHANNELS.JOB_STATUS, {
          photoId: event.photoId,
          status: event.status,
          agentIndex: event.agentIndex,
        });
        break;
      case 'job-thinking':
        send(BULK_CHANNELS.JOB_THINKING, {
          photoId: event.photoId,
          agentIndex: event.agentIndex,
          text: event.text,
        });
        break;
      case 'job-text':
        send(BULK_CHANNELS.JOB_TEXT, {
          photoId: event.photoId,
          agentIndex: event.agentIndex,
          text: event.text,
        });
        break;
      case 'job-tool-use':
        send(BULK_CHANNELS.JOB_TOOL_USE, {
          photoId: event.photoId,
          agentIndex: event.agentIndex,
          name: event.name,
        });
        break;
      case 'job-error':
        send(BULK_CHANNELS.JOB_ERROR, {
          photoId: event.photoId,
          error: event.error,
        });
        break;
      case 'all-done':
        send(BULK_CHANNELS.ALL_DONE, event.summary);
        // Desktop notification
        if (Notification.isSupported()) {
          const n = new Notification({
            title: 'Bulk Edit Complete',
            body: `${event.summary.done}/${event.summary.total} photos edited successfully.`,
          });
          n.show();
        }
        break;
    }
  };

  ipcMain.handle(
    BULK_CHANNELS.START,
    async (
      _event,
      photoIds: string[],
      options: { prompt: string; model?: string; provider?: string; parallelCount: number },
    ) => {
      if (manager?.isRunning()) {
        manager.stop();
      }

      manager = new BulkAgentManager();
      log.info(`Starting bulk edit: ${photoIds.length} photos, ${options.parallelCount} agents`);

      manager.start(photoIds, options, handleBulkEvent);
      return { ok: true };
    },
  );

  ipcMain.handle(BULK_CHANNELS.STOP, async () => {
    if (manager) {
      manager.stop();
      log.info('Bulk edit stopped by user');
    }
    return { ok: true };
  });

  ipcMain.handle(BULK_CHANNELS.STOP_JOB, async (_event, photoId: string) => {
    if (manager) {
      manager.stopJob(photoId);
      log.info(`Bulk edit: stopped single job ${photoId}`);
    }
    return { ok: true };
  });

  ipcMain.handle(BULK_CHANNELS.GET_STATUS, async () => {
    if (!manager) return { running: false, jobs: [] };
    return {
      running: manager.isRunning(),
      jobs: manager.getJobs(),
    };
  });

  app.on('before-quit', () => {
    manager?.stop();
    manager = null;
  });
}
