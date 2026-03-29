import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateEventFrame } from './utils.js';
import { createLogger } from './logger/index.js';

const log = createLogger('main/history');

function getHistoryDir() {
  const dir = path.join(app.getPath('userData'), 'history');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function hashId(photoId: string) {
  return crypto.createHash('md5').update(photoId).digest('hex');
}

function getHistoryPath(photoId: string) {
  return path.join(getHistoryDir(), `${hashId(photoId)}.json`);
}

export function registerHistoryHandlers() {
  ipcMain.handle('history:load', (event, photoId: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      const filePath = getHistoryPath(photoId);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      log.error('Failed to load history', err);
      return null;
    }
  });

  ipcMain.handle('history:save', (event, photoId: string, data: unknown) => {
    validateEventFrame(event.senderFrame!);
    try {
      const filePath = getHistoryPath(photoId);
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
      return true;
    } catch (err) {
      log.error('Failed to save history', err);
      return false;
    }
  });

  ipcMain.handle('history:delete', (event, photoId: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      const filePath = getHistoryPath(photoId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      log.error('Failed to delete history', err);
      return false;
    }
  });
}
