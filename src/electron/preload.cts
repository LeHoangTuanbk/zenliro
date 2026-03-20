const electron = require('electron');

electron.contextBridge.exposeInMainWorld('electron', {
  importPhotos:  () => electron.ipcRenderer.invoke('importPhotos'),
  exportPhoto:   (req: unknown) => electron.ipcRenderer.invoke('exportPhoto', req),
  selectFolder:  () => electron.ipcRenderer.invoke('selectFolder'),
  catalog: {
    load: () => electron.ipcRenderer.invoke('catalog:load'),
    save: (data: unknown) => electron.ipcRenderer.invoke('catalog:save', data),
  },
  photo: {
    loadFromPath: (filePath: string) => electron.ipcRenderer.invoke('photo:loadFromPath', filePath),
    saveThumbnail: (photoId: string, thumbnailDataUrl: string) => electron.ipcRenderer.invoke('photo:saveThumbnail', photoId, thumbnailDataUrl),
    generateThumbnail: (photoId: string, thumbnailDataUrl: string) => electron.ipcRenderer.invoke('photo:generateThumbnail', photoId, thumbnailDataUrl),
    loadThumbnail: (thumbnailPath: string) => electron.ipcRenderer.invoke('photo:loadThumbnail', thumbnailPath),
    deleteThumbnail: (thumbnailPath: string) => electron.ipcRenderer.invoke('photo:deleteThumbnail', thumbnailPath),
    deletePhoto: (photoId: string, thumbnailPath: string) => electron.ipcRenderer.invoke('photo:deletePhoto', photoId, thumbnailPath),
  },
  onImportProgress: (cb: (progress: { current: number; total: number } | null) => void) => {
    const handler = (_event: unknown, data: { current: number; total: number } | null) => cb(data);
    electron.ipcRenderer.on('import:progress', handler);
    return () => electron.ipcRenderer.removeListener('import:progress', handler);
  },
  onRequestSave: (cb: () => void) => electron.ipcRenderer.on('app:request-save', cb),
  sendSaveDone: () => electron.ipcRenderer.send('app:save-done'),
});
