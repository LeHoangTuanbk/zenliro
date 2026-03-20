import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { ipcMainHandle, isDev, validateEventFrame } from './utils.js';
import { getPreloadPath, getUIPath, getTrayIconPath } from './path-resolver.js';
import { registerCatalogHandlers } from './catalog.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readExifOrientation, readJpegRawDimensions, getOrientedDimensions } from './exif-orientation.js';

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
  setupTray(mainWindow);

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

    const total = result.filePaths.length;
    mainWindow.webContents.send('import:progress', { current: 0, total });

    const photos: ImportedPhoto[] = [];
    for (let fi = 0; fi < result.filePaths.length; fi++) {
      const filePath = result.filePaths[fi];
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
        const rawBuf = fs.readFileSync(filePath);
        const photoId = `${filePath}-${stats.mtimeMs}`;

        const thumbnailDataUrl = '';
        let photoWidth = 0;
        let photoHeight = 0;
        const orientation = await readExifOrientation(rawBuf);
        const rawDims = readJpegRawDimensions(rawBuf);
        if (rawDims) {
          const orientedDims = getOrientedDimensions(rawDims, orientation);
          photoWidth = orientedDims.width;
          photoHeight = orientedDims.height;
        } else {
          const img = nativeImage.createFromPath(filePath);
          if (!img.isEmpty()) {
            const imgSize = getOrientedDimensions(img.getSize(), orientation);
            photoWidth = imgSize.width;
            photoHeight = imgSize.height;
          }
        }

        photos.push({
          id: photoId,
          filePath,
          fileName: path.basename(filePath),
          fileSize: stats.size,
          mimeType,
          width: photoWidth,
          height: photoHeight,
          dataUrl: '',
          thumbnailDataUrl,
          orientation,
          importedAt: Date.now(),
        });
        mainWindow.webContents.send('import:progress', { current: fi + 1, total });
      } catch (err) {
        console.error('Failed to import photo:', filePath, err);
        mainWindow.webContents.send('import:progress', { current: fi + 1, total });
      }
    }
    mainWindow.webContents.send('import:progress', null);
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
    const template = req.namingTemplate ?? 'filename-sequence';
    const customText = req.customText || 'edit';
    const startNum = req.startNumber ?? 1;

    let fileName: string;
    if (template === 'filename') {
      fileName = `${baseName}.${ext}`;
    } else if (template === 'custom') {
      fileName = `${customText}_${startNum}.${ext}`;
    } else if (template === 'date') {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      fileName = `${dateStr}_${baseName}.${ext}`;
    } else {
      // filename-sequence (default)
      fileName = `${baseName}_${customText}_${startNum}.${ext}`;
    }

    const buffer = Buffer.from(req.base64, 'base64');

    // If destFolder is provided, save directly without showing a dialog
    if (req.destFolder) {
      const expanded = req.destFolder.replace(/^~/, os.homedir());
      fs.mkdirSync(expanded, { recursive: true });
      const outPath = path.join(expanded, fileName);
      fs.writeFileSync(outPath, buffer);
      return { saved: true, filePath: outPath };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Photo',
      defaultPath: path.join(app.getPath('pictures'), fileName),
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

function setupTray(mainWindow: BrowserWindow) {
  const icon = nativeImage.createFromPath(getTrayIconPath());
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('Zenliro');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Zenliro', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

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
