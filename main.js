const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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

  ipcMain.handle('system:get-cache', () => {
    const managers = ['npm', 'winget', 'pip', 'scoop', 'choco'];
    let allPackages = [];
    
    managers.forEach(mgr => {
      const data = cache.load(mgr);
      if (data && data.packages) {
        allPackages = allPackages.concat(data.packages);
      }
    });
    return allPackages;
  });

  ipcMain.handle('system:export-data', async (event, packages) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Migration Script',
      defaultPath: 'packvault-restore.bat',
      filters: [{ name: 'Batch Script', extensions: ['bat'] }, { name: 'Shell Script', extensions: ['sh'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    let scriptContent = '';
    const isWindows = filePath.endsWith('.bat');

    if (isWindows) {
      scriptContent += '@echo off\n';
      scriptContent += 'echo Restoring PackVault Packages...\n\n';
    } else {
      scriptContent += '#!/bin/bash\n';
      scriptContent += 'echo "Restoring PackVault Packages..."\n\n';
    }

    packages.forEach(p => {
      if (p.manager === 'npm') {
        scriptContent += `npm install -g ${p.name}\n`;
      } else if (p.manager === 'winget') {
        scriptContent += `winget install --id ${p.name} --exact --accept-package-agreements\n`;
      } else if (p.manager === 'pip') {
        scriptContent += `pip install ${p.name}\n`;
      }
    });

    scriptContent += '\necho "Restore complete!"\n';

    try {
      fs.writeFileSync(filePath, scriptContent);
      return { success: true, filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
