const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => process.versions.electron,
  scanAll: () => ipcRenderer.invoke('system:scan-all'),
  updatePackage: (manager, name) => ipcRenderer.invoke('system:update-package', { manager, name }),
  getCache: () => ipcRenderer.invoke('system:get-cache'),
  exportData: (packages) => ipcRenderer.invoke('system:export-data', packages)
});
