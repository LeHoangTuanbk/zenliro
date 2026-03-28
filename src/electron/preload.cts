const electron = require('electron');

// ── Global error catchers for renderer crash reporting ────────────────────────
window.addEventListener('error', (event) => {
  electron.ipcRenderer.invoke('logger:renderer-crash', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  electron.ipcRenderer.invoke('logger:renderer-crash', {
    message: String(event.reason),
    stack: event.reason?.stack,
  });
});

electron.contextBridge.exposeInMainWorld('electron', {
  getPathForFile: (file: File) => electron.webUtils.getPathForFile(file),
  importPhotos: () => electron.ipcRenderer.invoke('importPhotos'),
  importPhotosFromPaths: (paths: string[]) =>
    electron.ipcRenderer.invoke('importPhotosFromPaths', paths),
  exportPhoto: (req: unknown) => electron.ipcRenderer.invoke('exportPhoto', req),
  selectFolder: () => electron.ipcRenderer.invoke('selectFolder'),
  catalog: {
    load: () => electron.ipcRenderer.invoke('catalog:load'),
    save: (data: unknown) => electron.ipcRenderer.invoke('catalog:save', data),
  },
  photo: {
    loadFromPath: (filePath: string) => electron.ipcRenderer.invoke('photo:loadFromPath', filePath),
    saveThumbnail: (photoId: string, thumbnailDataUrl: string) =>
      electron.ipcRenderer.invoke('photo:saveThumbnail', photoId, thumbnailDataUrl),
    generateThumbnail: (photoId: string, thumbnailDataUrl: string) =>
      electron.ipcRenderer.invoke('photo:generateThumbnail', photoId, thumbnailDataUrl),
    loadThumbnail: (thumbnailPath: string) =>
      electron.ipcRenderer.invoke('photo:loadThumbnail', thumbnailPath),
    deleteThumbnail: (thumbnailPath: string) =>
      electron.ipcRenderer.invoke('photo:deleteThumbnail', thumbnailPath),
    deletePhoto: (photoId: string, thumbnailPath: string) =>
      electron.ipcRenderer.invoke('photo:deletePhoto', photoId, thumbnailPath),
  },
  onImportProgress: (cb: (progress: { current: number; total: number } | null) => void) => {
    const handler = (_event: unknown, data: { current: number; total: number } | null) => cb(data);
    electron.ipcRenderer.on('import:progress', handler);
    return () => electron.ipcRenderer.removeListener('import:progress', handler);
  },
  onRequestSave: (cb: () => void) => electron.ipcRenderer.on('app:request-save', cb),
  sendSaveDone: () => electron.ipcRenderer.send('app:save-done'),

  onMenuImport: (cb: () => void) => {
    const handler = () => cb();
    electron.ipcRenderer.on('menu:import', handler);
    return () => electron.ipcRenderer.removeListener('menu:import', handler);
  },
  onMenuExport: (cb: () => void) => {
    const handler = () => cb();
    electron.ipcRenderer.on('menu:export', handler);
    return () => electron.ipcRenderer.removeListener('menu:export', handler);
  },
  onMenuAction: (cb: (action: string) => void) => {
    const handler = (_event: unknown, action: string) => cb(action);
    electron.ipcRenderer.on('menu:action', handler);
    return () => electron.ipcRenderer.removeListener('menu:action', handler);
  },

  logger: {
    error: (scope: string, message: string, meta?: unknown) =>
      electron.ipcRenderer.invoke('logger:renderer-log', 'error', scope, message, meta),
    warn: (scope: string, message: string, meta?: unknown) =>
      electron.ipcRenderer.invoke('logger:renderer-log', 'warn', scope, message, meta),
    info: (scope: string, message: string, meta?: unknown) =>
      electron.ipcRenderer.invoke('logger:renderer-log', 'info', scope, message, meta),
    debug: (scope: string, message: string, meta?: unknown) =>
      electron.ipcRenderer.invoke('logger:renderer-log', 'debug', scope, message, meta),
  },
  exportLogs: () => electron.ipcRenderer.invoke('logger:export-logs'),

  agent: {
    startSession: () => electron.ipcRenderer.invoke('agent:start-session'),
    sendMessage: (text: string, options?: { model?: string; provider?: string }) =>
      electron.ipcRenderer.invoke('agent:send-message', text, options),
    stopSession: () => electron.ipcRenderer.invoke('agent:stop-session'),
    getStatus: () => electron.ipcRenderer.invoke('agent:get-status'),
    saveReferenceImage: (dataUrl: string) =>
      electron.ipcRenderer.invoke('agent:save-reference-image', dataUrl),
    loadModels: () => electron.ipcRenderer.invoke('agent:load-models'),

    onToolRequest: (
      channel: string,
      cb: (req: { requestId: string; payload?: unknown }) => void,
    ) => {
      const handler = (_event: unknown, data: { requestId: string; payload?: unknown }) => cb(data);
      electron.ipcRenderer.on(channel, handler);
      return () => electron.ipcRenderer.removeListener(channel, handler);
    },
    sendToolResult: (channel: string, data: unknown) => {
      electron.ipcRenderer.send(channel, data);
    },

    onStreamText: (cb: (chunk: string) => void) => {
      const handler = (_e: unknown, chunk: string) => cb(chunk);
      electron.ipcRenderer.on('agent:stream-text', handler);
      return () => electron.ipcRenderer.removeListener('agent:stream-text', handler);
    },
    onStreamToolUse: (cb: (data: { id: string; name: string; params: unknown }) => void) => {
      const handler = (_e: unknown, data: { id: string; name: string; params: unknown }) =>
        cb(data);
      electron.ipcRenderer.on('agent:stream-tool-use', handler);
      return () => electron.ipcRenderer.removeListener('agent:stream-tool-use', handler);
    },
    onStreamThinking: (cb: (text: string) => void) => {
      const handler = (_e: unknown, text: string) => cb(text);
      electron.ipcRenderer.on('agent:stream-thinking', handler);
      return () => electron.ipcRenderer.removeListener('agent:stream-thinking', handler);
    },
    onStreamDone: (cb: () => void) => {
      const handler = () => cb();
      electron.ipcRenderer.on('agent:stream-done', handler);
      return () => electron.ipcRenderer.removeListener('agent:stream-done', handler);
    },
    onStreamError: (cb: (error: string) => void) => {
      const handler = (_e: unknown, error: string) => cb(error);
      electron.ipcRenderer.on('agent:stream-error', handler);
      return () => electron.ipcRenderer.removeListener('agent:stream-error', handler);
    },
  },
});
