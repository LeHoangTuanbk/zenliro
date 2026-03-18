import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { validateEventFrame } from './utils.js';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff',
  bmp: 'image/bmp', gif: 'image/gif',
};

export function registerCatalogHandlers() {
  const catalogPath = path.join(app.getPath('userData'), 'catalog.json');

  ipcMain.handle('catalog:load', (event) => {
    validateEventFrame(event.senderFrame!);
    try {
      if (!fs.existsSync(catalogPath)) return null;
      return JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('catalog:save', (event, data: unknown) => {
    validateEventFrame(event.senderFrame!);
    try {
      fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('photo:loadFromPath', (event, filePath: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mimeType = MIME_MAP[ext] ?? 'image/jpeg';
      const base64 = fs.readFileSync(filePath).toString('base64');
      return { dataUrl: `data:${mimeType};base64,${base64}` };
    } catch {
      return null;
    }
  });
}
