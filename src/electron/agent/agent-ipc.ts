import { BrowserWindow, ipcMain } from 'electron';
import { ClaudeCodeManager } from './claude-code-manager.js';
import type { ParsedStreamEvent } from './stream-parser.js';

let manager: ClaudeCodeManager | null = null;

export function registerAgentIpc(mainWindow: BrowserWindow) {
  const send = (channel: string, data?: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  const handleStreamEvent = (event: ParsedStreamEvent) => {
    switch (event.type) {
      case 'text':
        send('agent:stream-text', event.text);
        break;
      case 'thinking':
        send('agent:stream-thinking', event.text);
        break;
      case 'tool_use':
        send('agent:stream-tool-use', {
          id: event.id,
          name: event.name,
          params: event.params,
        });
        break;
      case 'session_id':
        manager?.setSessionId(event.sessionId);
        break;
      case 'done':
        send('agent:stream-done');
        break;
      case 'error':
        send('agent:stream-error', event.error);
        break;
    }
  };

  ipcMain.handle('agent:start-session', async () => {
    if (!manager) manager = new ClaudeCodeManager();
  });

  ipcMain.handle('agent:send-message', async (_event, text: string) => {
    if (!manager) manager = new ClaudeCodeManager();
    manager.sendMessage(text, handleStreamEvent);
  });

  ipcMain.handle('agent:stop-session', async () => {
    manager?.stop();
    manager = null;
  });

  ipcMain.handle('agent:get-status', async () => {
    return { running: manager?.isRunning() ?? false };
  });
}
