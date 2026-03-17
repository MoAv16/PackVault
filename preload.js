const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => process.versions.electron,
  scanAll: () => ipcRenderer.invoke('system:scan-all')
});
