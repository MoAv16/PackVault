const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => process.versions.electron,
  scanAll: (target) => ipcRenderer.invoke('system:scan-all', target),
  updatePackage: (manager, name) => ipcRenderer.invoke('system:update-package', { manager, name }),
  getCache: () => ipcRenderer.invoke('system:get-cache'),
  exportData: (packages) => ipcRenderer.invoke('system:export-data', packages)
});
