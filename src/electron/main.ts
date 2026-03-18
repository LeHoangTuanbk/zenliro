import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { ipcMainHandle, isDev, validateEventFrame } from './utils.js';
import { getPreloadPath, getUIPath } from './path-resolver.js';
import { registerCatalogHandlers } from './catalog.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(getUIPath());
  }

  registerCatalogHandlers();

  // ── Import ────────────────────────────────────────────────────────────────
  ipcMainHandle('importPhotos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Photos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const photos: ImportedPhoto[] = [];
    for (const filePath of result.filePaths) {
      try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          tiff: 'image/tiff',
          tif: 'image/tiff',
          bmp: 'image/bmp',
          gif: 'image/gif',
        };
        const mimeType = mimeMap[ext] || 'image/jpeg';
        const base64 = fs.readFileSync(filePath).toString('base64');
        photos.push({
          id: `${filePath}-${stats.mtimeMs}`,
          filePath,
          fileName: path.basename(filePath),
          fileSize: stats.size,
          mimeType,
          width: 0,
          height: 0,
          dataUrl: `data:${mimeType};base64,${base64}`,
          importedAt: Date.now(),
        });
      } catch (err) {
        console.error('Failed to import photo:', filePath, err);
      }
    }
    return photos;
  });

  // ── Select Folder ─────────────────────────────────────────────────────────
  ipcMain.handle('selectFolder', async (event) => {
    validateEventFrame(event.senderFrame!);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Export ────────────────────────────────────────────────────────────────
  ipcMain.handle('exportPhoto', async (event, req: ExportPhotoRequest) => {
    validateEventFrame(event.senderFrame!);

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = extMap[req.mimeType] ?? 'jpg';
    const baseName = req.defaultName.replace(/\.[^.]+$/, '');

    const buffer = Buffer.from(req.base64, 'base64');

    // If destFolder is provided, save directly without showing a dialog
    if (req.destFolder) {
      const expanded = req.destFolder.replace(/^~/, os.homedir());
      fs.mkdirSync(expanded, { recursive: true });
      const outPath = path.join(expanded, `${baseName}_edited.${ext}`);
      fs.writeFileSync(outPath, buffer);
      return { saved: true, filePath: outPath };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Photo',
      defaultPath: path.join(app.getPath('pictures'), `${baseName}_edited.${ext}`),
      filters: [
        {
          name:
            req.mimeType === 'image/png' ? 'PNG' : req.mimeType === 'image/webp' ? 'WebP' : 'JPEG',
          extensions: [ext],
        },
      ],
    });

    if (result.canceled || !result.filePath) return { saved: false };

    fs.writeFileSync(result.filePath, buffer);
    return { saved: true, filePath: result.filePath };
  });

  handleCloseEvents(mainWindow);
});

function handleCloseEvents(mainWindow: BrowserWindow) {
  let quitting = false;

  mainWindow.on('close', (e) => {
    if (quitting) return;
    // On macOS: hide window but keep dock icon so user can reopen
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Clicking dock icon when window is hidden → show again
  app.on('activate', () => {
    if (!mainWindow.isVisible()) mainWindow.show();
  });

  // Before quitting: ask renderer to save, wait for ack (max 3s) then quit
  app.on('before-quit', (e) => {
    if (quitting) return;
    e.preventDefault();
    quitting = true;

    const timeout = setTimeout(() => app.quit(), 3000);

    ipcMain.once('app:save-done', () => {
      clearTimeout(timeout);
      app.quit();
    });

    mainWindow.webContents.send('app:request-save');
  });
}
