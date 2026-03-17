const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => process.versions.electron,
  scanAll: (target) => ipcRenderer.invoke('system:scan-all', target),
  updatePackage: (manager, name) => ipcRenderer.invoke('system:update-package', { manager, name }),
  runAudit: (manager) => ipcRenderer.invoke('system:run-audit', manager),
  getCache: () => ipcRenderer.invoke('system:get-cache'),
  clearCache: () => ipcRenderer.invoke('system:clear-cache'),
  exportData: (packages) => ipcRenderer.invoke('system:export-data', packages),
  toggleTheme: () => ipcRenderer.invoke('dark-mode:toggle'),
  systemTheme: () => ipcRenderer.invoke('dark-mode:system'),
  getThemeStatus: () => ipcRenderer.invoke('dark-mode:get-status')
});
