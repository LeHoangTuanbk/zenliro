import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { validateEventFrame } from './utils.js';
import { createLogger } from './logger/index.js';

const log = createLogger('main/chat-history');

const MAX_CHATS = 20;

function getChatDir() {
  const dir = path.join(app.getPath('userData'), 'chat-history');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatPath(chatId: string) {
  return path.join(getChatDir(), `${chatId}.json`);
}

export function registerChatHistoryHandlers() {
  ipcMain.handle('chat-history:list', (event) => {
    validateEventFrame(event.senderFrame!);
    try {
      const dir = getChatDir();
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      const chats: Array<{ id: string; title: string; updatedAt: number }> = [];

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
          const data = JSON.parse(raw);
          chats.push({
            id: data.id,
            title: data.title ?? 'Untitled',
            updatedAt: data.updatedAt ?? 0,
          });
        } catch {
          // Skip corrupt files
        }
      }

      // Sort newest first
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      return chats;
    } catch (err) {
      log.error('Failed to list chat history', err);
      return [];
    }
  });

  ipcMain.handle('chat-history:load', (event, chatId: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      const filePath = getChatPath(chatId);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      log.error('Failed to load chat', err);
      return null;
    }
  });

  ipcMain.handle('chat-history:save', (event, data: unknown) => {
    validateEventFrame(event.senderFrame!);
    try {
      const chat = data as { id: string; title: string; messages: unknown[]; updatedAt: number };
      const filePath = getChatPath(chat.id);
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

      // Enforce max chats limit — delete oldest
      const dir = getChatDir();
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      if (files.length > MAX_CHATS) {
        const entries: Array<{ file: string; updatedAt: number }> = [];
        for (const file of files) {
          try {
            const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
            const d = JSON.parse(raw);
            entries.push({ file, updatedAt: d.updatedAt ?? 0 });
          } catch {
            entries.push({ file, updatedAt: 0 });
          }
        }
        entries.sort((a, b) => a.updatedAt - b.updatedAt);
        const toDelete = entries.slice(0, entries.length - MAX_CHATS);
        for (const e of toDelete) {
          try {
            fs.unlinkSync(path.join(dir, e.file));
          } catch {
            /* ignore */
          }
        }
      }

      return true;
    } catch (err) {
      log.error('Failed to save chat', err);
      return false;
    }
  });

  ipcMain.handle('chat-history:delete', (event, chatId: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      const filePath = getChatPath(chatId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      log.error('Failed to delete chat', err);
      return false;
    }
  });
}
