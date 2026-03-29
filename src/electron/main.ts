import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { ipcMainHandle, isDev, validateEventFrame } from './utils.js';
import { getPreloadPath, getUIPath, getTrayIconPath } from './path-resolver.js';
import { registerCatalogHandlers } from './catalog.js';
import { registerHistoryHandlers } from './history.js';
import { registerAgentIpc } from './agent/agent-ipc.js';
import { setMainWindow } from './mcp/ipc-bridge.js';
import { startLocalServer, stopLocalServer } from './mcp/local-server.js';
import { registerMcpGlobally } from './mcp/register-global.js';
import { createMenu } from './create-menu.js';
import {
  initializeLogger,
  installMainCrashHandler,
  installRendererCrashHandler,
  createLogger,
  exportLogsToFile,
  IPC_RENDERER_LOG,
  IPC_EXPORT_LOGS,
} from './logger/index.js';
import type { LogLevel } from './logger/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  readExifOrientation,
  readJpegRawDimensions,
  getOrientedDimensions,
} from './libs/exif-orientation.js';
import { isHeic, convertHeicToJpeg } from './libs/heic-converter.js';

initializeLogger();
installMainCrashHandler();

const logMain = createLogger('main');

app.on('ready', () => {
  logMain.info('App ready, initializing...');

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

  // Prevent Electron from navigating when files are dropped onto the window
  mainWindow.webContents.on('will-navigate', (e, url) => {
    // Allow dev server navigation, block file:// drops
    if (url.startsWith('file://')) e.preventDefault();
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(getUIPath());
    // TODO: Will disable devtools in production later
    // mainWindow.webContents.on('before-input-event', (_e, input) => {
    //   const isDevToolsShortcut =
    //     (input.key === 'I' && input.control && input.shift) ||
    //     (input.key === 'I' && input.meta && input.alt) ||
    //     input.key === 'F12';
    //   if (isDevToolsShortcut) _e.preventDefault();
    // });

    // mainWindow.webContents.on('devtools-opened', () => {
    //   mainWindow.webContents.closeDevTools();
    // });
  }

  createMenu(mainWindow);
  registerCatalogHandlers();
  registerHistoryHandlers();
  registerAgentIpc(mainWindow);
  setMainWindow(mainWindow);
  setupTray(mainWindow);
  installRendererCrashHandler(mainWindow);

  // ── Logger IPC ──────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_RENDERER_LOG,
    (event, level: LogLevel, scope: string, message: string, meta?: unknown) => {
      validateEventFrame(event.senderFrame!);
      const scopedLog = createLogger(`renderer/${scope}`);
      if (meta !== undefined) {
        scopedLog[level](message, meta);
      } else {
        scopedLog[level](message);
      }
    },
  );

  ipcMain.handle(IPC_EXPORT_LOGS, (event) => {
    validateEventFrame(event.senderFrame!);
    return exportLogsToFile(mainWindow);
  });

  // Start local HTTP bridge for MCP server and register globally in Claude Code
  startLocalServer()
    .then(() => {
      registerMcpGlobally();
    })
    .catch((err) => {
      logMain.error('Failed to start local MCP bridge:', err);
    });

  // ── Import ────────────────────────────────────────────────────────────────
  const SUPPORTED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'tiff',
    'tif',
    'bmp',
    'gif',
    'heic',
    'heif',
    'avif',
    'cr2',
    'cr3',
    'nef',
    'arw',
    'dng',
    'raf',
    'orf',
    'rw2',
    'pef',
    'srw',
    'x3f',
    '3fr',
    'rwl',
    'mrw',
    'kdc',
    'dcr',
    'raw',
  ];
  const RAW_EXTENSIONS = new Set([
    'cr2',
    'cr3',
    'nef',
    'arw',
    'dng',
    'raf',
    'orf',
    'rw2',
    'pef',
    'srw',
    'x3f',
    '3fr',
    'rwl',
    'mrw',
    'kdc',
    'dcr',
    'raw',
  ]);
  const MIME_MAP: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
  };
  const SUPPORTED_SET = new Set(SUPPORTED_EXTENSIONS);

  async function importFromPaths(filePaths: string[]): Promise<ImportedPhoto[]> {
    const total = filePaths.length;
    logMain.info(`Import started: ${total} file(s)`);
    mainWindow.webContents.send('import:progress', { current: 0, total });

    const photos: ImportedPhoto[] = [];
    for (let fi = 0; fi < filePaths.length; fi++) {
      const filePath = filePaths[fi];
      try {
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        if (!SUPPORTED_SET.has(ext)) {
          mainWindow.webContents.send('import:progress', { current: fi + 1, total });
          continue;
        }
        const stats = fs.statSync(filePath);
        const isRaw = RAW_EXTENSIONS.has(ext);
        const isHeicFile = isHeic(ext);
        const mimeType = isRaw ? 'image/x-raw' : MIME_MAP[ext] || 'image/jpeg';
        const rawBuf = fs.readFileSync(filePath);
        const photoId = `${filePath}-${stats.mtimeMs}`;

        let photoWidth = 0;
        let photoHeight = 0;
        const decodeBuf = isHeicFile ? await convertHeicToJpeg(rawBuf) : rawBuf;
        const orientation = isRaw ? 1 : await readExifOrientation(decodeBuf);
        if (!isRaw) {
          const rawDims = readJpegRawDimensions(decodeBuf);
          if (rawDims) {
            const orientedDims = getOrientedDimensions(rawDims, orientation);
            photoWidth = orientedDims.width;
            photoHeight = orientedDims.height;
          } else {
            const img = isHeicFile
              ? nativeImage.createFromBuffer(decodeBuf)
              : nativeImage.createFromPath(filePath);
            if (!img.isEmpty()) {
              const imgSize = getOrientedDimensions(img.getSize(), orientation);
              photoWidth = imgSize.width;
              photoHeight = imgSize.height;
            }
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
          thumbnailDataUrl: '',
          orientation,
          importedAt: Date.now(),
        });
        mainWindow.webContents.send('import:progress', { current: fi + 1, total });
      } catch (err) {
        logMain.error('Failed to import photo:', filePath, err);
        mainWindow.webContents.send('import:progress', { current: fi + 1, total });
      }
    }
    mainWindow.webContents.send('import:progress', null);
    logMain.info(`Import complete: ${photos.length}/${total} photo(s) imported`);
    return photos;
  }

  ipcMainHandle('importPhotos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Photos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS }],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return importFromPaths(result.filePaths);
  });

  ipcMain.handle('importPhotosFromPaths', async (event, filePaths: string[]) => {
    validateEventFrame(event.senderFrame!);
    if (!filePaths || filePaths.length === 0) return [];
    return importFromPaths(filePaths);
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
    logMain.info(`Export started: ${fileName} (${req.mimeType})`);

    if (req.destFolder) {
      const expanded = req.destFolder.replace(/^~/, os.homedir());
      fs.mkdirSync(expanded, { recursive: true });
      const outPath = path.join(expanded, fileName);
      fs.writeFileSync(outPath, buffer);
      logMain.info(`Export complete: ${outPath}`);
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
    logMain.info(`Export complete: ${result.filePath}`);
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

  // Before quitting: clean up MCP bridge, ask renderer to save, wait for ack (max 3s) then quit
  app.on('before-quit', (e) => {
    if (quitting) return;
    e.preventDefault();
    quitting = true;
    logMain.info('App quitting, saving state...');

    stopLocalServer();

    const timeout = setTimeout(() => app.quit(), 3000);

    ipcMain.once('app:save-done', () => {
      clearTimeout(timeout);
      app.quit();
    });

    mainWindow.webContents.send('app:request-save');
  });
}
