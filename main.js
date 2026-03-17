const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const scanner = require('./src/lib/scanner.js');
const cache = require('./src/lib/cache.js');
const updater = require('./src/lib/updater.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('src/index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('system:scan-all', async () => {
    const results = await scanner.scanAll();
    
    // Save available managers to cache
    results.forEach(res => {
      if (res.available && res.packages.length > 0) {
        cache.save(res.manager, res);
      }
    });
    
    return results;
  });

  ipcMain.handle('system:update-package', async (event, { manager, name }) => {
    return await updater.updatePackage(manager, name);
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
