const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const scanner = require('./src/lib/scanner.js');
const cache = require('./src/lib/cache.js');

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
  ipcMain.handle('system:scan-npm', async () => {
    // 1. Check cache first (optional early return, but we'll do a fresh scan for now to test)
    // 2. Perform scan
    const result = await scanner.scanNpm();
    
    // 3. Save to cache
    if (result.available) {
      cache.save('npm', result);
    }
    
    return result;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
