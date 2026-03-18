const electron = require('electron');

electron.contextBridge.exposeInMainWorld('electron', {
  importPhotos:  () => electron.ipcRenderer.invoke('importPhotos'),
  exportPhoto:   (req: unknown) => electron.ipcRenderer.invoke('exportPhoto', req),
  selectFolder:  () => electron.ipcRenderer.invoke('selectFolder'),
});
