import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateEventFrame } from './utils.js';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff',
  bmp: 'image/bmp', gif: 'image/gif',
};

function getThumbnailDir() {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function hashId(photoId: string) {
  return crypto.createHash('md5').update(photoId).digest('hex');
}

export function registerCatalogHandlers() {
  const catalogPath = path.join(app.getPath('userData'), 'catalog.json');

  const persistThumbnail = (photoId: string, thumbnailDataUrl: string) => {
    const base64 = thumbnailDataUrl.split(',')[1];
    if (!base64) return null;
    const jpegBuffer = Buffer.from(base64, 'base64');
    const thumbPath = path.join(getThumbnailDir(), `${hashId(photoId)}.jpg`);
    fs.writeFileSync(thumbPath, jpegBuffer);
    return { thumbnailPath: thumbPath, thumbnailDataUrl };
  };

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
      const bytes = Uint8Array.from(fs.readFileSync(filePath));
      return { mimeType, bytes };
    } catch {
      return null;
    }
  });

  ipcMain.handle('photo:saveThumbnail', (event, photoId: string, thumbnailDataUrl: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      return persistThumbnail(photoId, thumbnailDataUrl);
    } catch {
      return null;
    }
  });

  ipcMain.handle('photo:generateThumbnail', (event, photoId: string, thumbnailDataUrl: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      return persistThumbnail(photoId, thumbnailDataUrl);
    } catch {
      return null;
    }
  });

  ipcMain.handle('photo:loadThumbnail', (event, thumbnailPath: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      if (!fs.existsSync(thumbnailPath)) return null;
      const b64 = fs.readFileSync(thumbnailPath).toString('base64');
      return { thumbnailDataUrl: `data:image/jpeg;base64,${b64}` };
    } catch {
      return null;
    }
  });

  ipcMain.handle('photo:deleteThumbnail', (event, thumbnailPath: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('photo:deletePhoto', (event, photoId: string, thumbnailPath: string) => {
    validateEventFrame(event.senderFrame!);
    try {
      if (thumbnailPath && fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
      return true;
    } catch {
      return false;
    }
  });
}
