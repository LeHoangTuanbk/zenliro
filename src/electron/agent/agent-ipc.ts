import { BrowserWindow, ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
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

  ipcMain.handle('agent:send-message', async (_event, text: string, options?: { model?: string }) => {
    if (!manager) manager = new ClaudeCodeManager();
    manager.sendMessage(text, handleStreamEvent, options);
  });

  ipcMain.handle('agent:stop-session', async () => {
    manager?.stop();
    manager = null;
  });

  ipcMain.handle('agent:get-status', async () => {
    return { running: manager?.isRunning() ?? false };
  });

  // Kill agent process when app is quitting
  app.on('before-quit', () => {
    manager?.stop();
    manager = null;
  });

  ipcMain.handle('agent:save-reference-image', async (_event, dataUrl: string) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const tempDir = path.join(app.getPath('temp'), 'zenliro');
      fs.mkdirSync(tempDir, { recursive: true });
      const filePath = path.join(tempDir, `reference-${Date.now()}.jpg`);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (err) {
      console.error('[Agent] Failed to save reference image:', err);
      return null;
    }
  });
}
