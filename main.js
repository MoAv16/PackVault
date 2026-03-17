const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const scanner = require('./src/lib/scanner.js');
const cache = require('./src/lib/cache.js');
const updater = require('./src/lib/updater.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('src/index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light'
    } else {
      nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
  });

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
  });

  ipcMain.handle('system:scan-all', async (event, target = 'all') => {
    let results = [];
    
    if (target === 'all') {
      results = await scanner.scanAll();
    } else {
      // Map view categories to specific scan functions
      switch (target) {
        case 'npm': results = [await scanner.scanNpm()]; break;
        case 'pip': results = [await scanner.scanPip()]; break;
        case 'winget': results = [await scanner.scanWinget()]; break;
        case 'scoop': results = [await scanner.scanScoop()]; break;
        case 'choco': results = [await scanner.scanChoco()]; break;
        case 'system': results = [await scanner.scanSystemPrograms()]; break;
        case 'desktop': results = [await scanner.scanSystemPrograms(), await scanner.scanWinget()]; break; // Mixed
        case 'runtimes': results = await scanner.scanAll(); break; // Scan all but filter in renderer
        default: results = await scanner.scanAll();
      }
    }
    
    // Save available managers to cache
    results.forEach(res => {
      if (res && res.available && res.packages.length > 0) {
        cache.save(res.manager, res);
      }
    });
    
    return results;
  });

  ipcMain.handle('system:update-package', async (event, { manager, name }) => {
    return await updater.updatePackage(manager, name);
  });

  ipcMain.handle('system:run-audit', async (event, manager) => {
    return await scanner.runAudit(manager);
  });

  ipcMain.handle('system:get-cache', () => {
    const managers = ['npm', 'winget', 'pip', 'scoop', 'choco', 'system'];
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
