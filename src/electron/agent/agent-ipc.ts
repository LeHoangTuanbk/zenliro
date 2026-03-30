import { BrowserWindow, ipcMain, app } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ClaudeCodeManager } from './claude-code-manager.js';
import { CodexManager } from './codex-manager.js';
import { loadAllModels } from './load-models.js';
import { getShellEnv } from './shell-env.js';
import { CLAUDE_CLI } from './const.js';
import type { ParsedStreamEvent } from './stream-parser.js';
import { createLogger } from '../logger/index.js';

const log = createLogger('main/agent');

type AgentProvider = 'claude' | 'codex';

type ManagerLike = {
  isRunning(): boolean;
  sendMessage(
    text: string,
    onEvent: (e: ParsedStreamEvent) => void,
    options?: { model?: string },
  ): void;
  stop(): void;
  setSessionId(id: string): void;
};

let manager: ManagerLike | null = null;
let currentProvider: AgentProvider | null = null;

function createManager(provider: AgentProvider): ManagerLike {
  return provider === 'codex' ? new CodexManager() : new ClaudeCodeManager();
}

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
    if (!manager) {
      currentProvider = 'claude';
      manager = createManager('claude');
      log.info('Agent session started (provider: claude)');
    }
  });

  ipcMain.handle(
    'agent:send-message',
    async (_event, text: string, options?: { model?: string; provider?: AgentProvider }) => {
      const provider = options?.provider ?? 'claude';

      // Provider changed → must create new manager (new session)
      if (provider !== currentProvider) {
        manager?.stop();
        manager = createManager(provider);
        currentProvider = provider;
        log.info(`Agent provider switched to: ${provider}`);
      }

      if (!manager) {
        manager = createManager(provider);
        currentProvider = provider;
      }

      log.info(
        `Agent message sent (provider: ${provider}, model: ${options?.model ?? 'default'}, length: ${text.length})`,
      );
      manager.sendMessage(text, handleStreamEvent, options);
    },
  );

  ipcMain.handle('agent:stop-session', async () => {
    manager?.stop();
    manager = null;
    currentProvider = null;
    log.info('Agent session stopped');
  });

  ipcMain.handle('agent:get-status', async () => {
    return { running: manager?.isRunning() ?? false };
  });

  ipcMain.handle('agent:load-models', async () => {
    return loadAllModels();
  });

  app.on('before-quit', () => {
    manager?.stop();
    manager = null;
  });

  ipcMain.handle(
    'agent:generate-title',
    async (_event, userMessage: string, assistantMessage: string) => {
      const fallback = userMessage.replace(/\n/g, ' ').trim().slice(0, 50);
      try {
        const prompt = `Generate a very short title (max 6 words, no quotes, no markdown) for this photo editing conversation:\nUser: ${userMessage.slice(0, 200)}\nAssistant: ${assistantMessage.slice(0, 200)}`;
        log.info('Generating chat title via Haiku...');
        return new Promise<string>((resolve) => {
          execFile(
            CLAUDE_CLI,
            ['--print', '--model', 'haiku', prompt],
            { env: getShellEnv(), timeout: 30_000 },
            (err, stdout, stderr) => {
              if (err) {
                log.warn('Title generation failed:', err.message);
                if (stderr) log.warn('stderr:', stderr);
                resolve(fallback);
                return;
              }
              const title = stdout.trim().slice(0, 60);
              if (!title) {
                log.warn('Title generation returned empty');
                resolve(fallback);
                return;
              }
              log.info(`Generated title: "${title}"`);
              resolve(title);
            },
          );
        });
      } catch (err) {
        log.error('Title generation threw:', err);
        return fallback;
      }
    },
  );

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
      log.error('Failed to save reference image:', err);
      return null;
    }
  });
}
