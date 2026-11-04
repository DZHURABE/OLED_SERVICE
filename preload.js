const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('oledNative', {
  writeBackup: (json) => ipcRenderer.invoke('backup:write', json),
  backupInfo: () => ipcRenderer.invoke('backup:info'),
  openBackupFolder: () => ipcRenderer.invoke('backup:open'),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:choose'),
  savePdf: (html, name) => ipcRenderer.invoke('pdf:save', html, name),
  setZoom: (f) => webFrame.setZoomFactor(f)
});
