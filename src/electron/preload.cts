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
  },
  onRequestSave: (cb: () => void) => electron.ipcRenderer.on('app:request-save', cb),
  sendSaveDone: () => electron.ipcRenderer.send('app:save-done'),
});
