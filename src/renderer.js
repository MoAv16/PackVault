let currentPackages = [];
let selectedPackages = new Set();
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan-all');
  const btnExport = document.getElementById('btn-export');
  const tbody = document.getElementById('packages-body');
  const statTotal = document.getElementById('stat-total');
  const searchInput = document.getElementById('search-input');
  const navItems = document.querySelectorAll('nav li');
  const collectionBadge = document.getElementById('collection-badge');
  const btnThemeToggle = document.getElementById('btn-theme-toggle-settings');
  const btnClearCache = document.getElementById('btn-clear-cache');
  
  const mainTopbar = document.getElementById('main-topbar');
  const mainTableContainer = document.getElementById('main-table-container');
  const settingsView = document.getElementById('settings-view');
  const appVersionText = document.getElementById('app-version-text');

  // Load Version Info
  appVersionText.textContent = `Electron: ${window.electronAPI.getAppVersion()}`;

  // Initialize Theme on Startup
  async function initTheme() {
    const isDark = await window.electronAPI.getThemeStatus();
    updateThemeUI(isDark);
  }
  initTheme();

  btnThemeToggle.addEventListener('click', async () => {
    const isDarkMode = await window.electronAPI.toggleTheme();
    updateThemeUI(isDarkMode);
  });

  btnClearCache.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the local cache? You will need to scan your system again.')) {
      await window.electronAPI.clearCache();
      currentPackages = [];
      renderTable();
      alert('Cache cleared.');
    }
  });

  function updateThemeUI(isDark) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  function updateSidebarBadge() {
    const count = selectedPackages.size;
    collectionBadge.textContent = count;
    if (count > 0) {
      collectionBadge.classList.add('visible');
    } else {
      collectionBadge.classList.remove('visible');
    }
  }

  function renderTable() {
    if (currentFilter === 'settings') {
      mainTopbar.style.display = 'none';
      mainTableContainer.style.display = 'none';
      settingsView.classList.add('active');
      return;
    } else {
      mainTopbar.style.display = 'flex';
      mainTableContainer.style.display = 'block';
      settingsView.classList.remove('active');
    }

    let filtered = currentPackages;
    
    if (currentFilter === 'collection') {
      filtered = currentPackages.filter(p => selectedPackages.has(p.name));
    } else if (currentFilter !== 'all') {
      filtered = currentPackages.filter(p => p.category === currentFilter);
    }
    
    const term = searchInput.value.toLowerCase();
    if (term) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${currentFilter === 'collection' ? 'Collection is empty. Add packages from "All Packages".' : 'No packages found.'}</td></tr>`;
      statTotal.textContent = '0';
      return;
    }

    statTotal.textContent = filtered.length.toString();
    tbody.innerHTML = filtered.map(p => {
      const isOutdated = p.latest && p.latest !== p.version && p.latest !== 'unknown';
      const isSelected = selectedPackages.has(p.name);
      
      return `
        <tr class="row-clickable ${isSelected ? 'row-selected' : ''}">
          <td class="checkbox-cell">
            <span class="vault-toggle ${isSelected ? 'selected' : 'unselected'}" data-name="${p.name}">
              ${isSelected ? '🔖' : '📑'}
            </span>
          </td>
          <td>${p.name}</td>
          <td>${p.version}</td>
          <td class="${isOutdated ? 'outdated' : ''}">${p.latest || p.version}</td>
          <td><span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #333;">${p.manager}</span></td>
          <td>
            <button class="btn primary btn-update" data-manager="${p.manager}" data-name="${p.name}" style="padding: 4px 8px; font-size: 0.8rem;">Update</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Modal elements
  const modal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('close-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');
  const modalBtnAudit = document.getElementById('modal-btn-audit');
  let currentDetailPkg = null;

  // Row click for details
  tbody.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.vault-toggle') || e.target.classList.contains('vault-toggle')) return;
    
    const tr = e.target.closest('tr');
    if (!tr) return;
    
    const name = tr.querySelector('.vault-toggle')?.getAttribute('data-name');
    if (!name) return;
    
    const pkg = currentPackages.find(p => p.name === name);
    if (pkg) {
      currentDetailPkg = pkg;
      modalTitle.textContent = pkg.name;
      modalBody.innerHTML = `
        <div class="detail-row"><span class="detail-label">Manager:</span> ${pkg.manager.toUpperCase()}</div>
        <div class="detail-row"><span class="detail-label">Current:</span> ${pkg.version}</div>
        <div class="detail-row"><span class="detail-label">Latest:</span> ${pkg.latest || pkg.version}</div>
        <div class="detail-row"><span class="detail-label">Category:</span> ${pkg.category}</div>
        <hr style="margin: 15px 0; border:0; border-top:1px solid #eee;">
        <div id="audit-results" style="font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; display: none; white-space: pre-wrap; font-size: 0.8rem; color: #333;"></div>
      `;
      modal.classList.add('active');
    }
  });

  btnCloseModal.addEventListener('click', () => modal.classList.remove('active'));
  
  modalBtnAudit.addEventListener('click', async () => {
    if (!currentDetailPkg) return;
    const resDiv = document.getElementById('audit-results');
    resDiv.style.display = 'block';
    resDiv.textContent = 'Running security audit...';
    modalBtnAudit.disabled = true;
    try {
        const result = await window.electronAPI.runAudit(currentDetailPkg.manager);
        resDiv.textContent = JSON.stringify(result, null, 2);
    } catch(e) {
        resDiv.textContent = 'Audit failed: ' + e.message;
    } finally {
        modalBtnAudit.disabled = false;
    }
  });

  // Load cache on startup
  async function loadCache() {
    try {
      const cachedData = await window.electronAPI.getCache();
      if (cachedData && cachedData.length > 0) {
        currentPackages = cachedData;
        renderTable();
      }
    } catch (e) {
      console.error("Error loading cache", e);
    }
  }
  loadCache();

  // Sidebar Filter Logic
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target.closest('li');
      if (!target) return;
      const view = target.getAttribute('data-view');
      if (!view) return;
      navItems.forEach(nav => nav.classList.remove('active'));
      target.classList.add('active');
      currentFilter = view;
      renderTable();
    });
  });

  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Scanning... This may take a few seconds.</td></tr>';
    
    try {
      const results = await window.electronAPI.scanAll(currentFilter);
      
      if (currentFilter !== 'all' && currentFilter !== 'collection' && currentFilter !== 'settings') {
        const scannedManager = results[0]?.manager;
        if (scannedManager) {
          currentPackages = currentPackages.filter(p => p.manager !== scannedManager);
          results.forEach(res => {
            if (res.available && res.packages) {
              currentPackages = currentPackages.concat(res.packages);
            }
          });
        }
      } else {
        currentPackages = [];
        results.forEach(res => {
          if (res && res.available && res.packages) {
            currentPackages = currentPackages.concat(res.packages);
          }
        });
      }
      
      renderTable();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = 'Scan System';
    }
  });

  // Vault Selection Logic (Icon Click)
  tbody.addEventListener('click', (e) => {
    const toggle = e.target.closest('.vault-toggle');
    if (toggle) {
      const name = toggle.getAttribute('data-name');
      if (selectedPackages.has(name)) {
        selectedPackages.delete(name);
      } else {
        selectedPackages.add(name);
      }
      updateSidebarBadge();
      renderTable();
    }
  });

  // Export Logic
  btnExport.addEventListener('click', async () => {
    const packagesToExport = currentFilter === 'collection' 
      ? currentPackages.filter(p => selectedPackages.has(p.name))
      : currentPackages;

    if (packagesToExport.length === 0) {
      alert("No packages to export. Selection is empty.");
      return;
    }
    
    btnExport.disabled = true;
    btnExport.textContent = 'Exporting...';
    
    try {
      const result = await window.electronAPI.exportData(packagesToExport);
      if (result.success) {
        alert('Script saved to: ' + result.filePath);
      } else if (!result.canceled) {
        alert('Export failed: ' + result.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      btnExport.disabled = false;
      btnExport.textContent = 'Export Selection';
    }
  });

  searchInput.addEventListener('input', () => {
    renderTable();
  });

  // Handle dynamic update buttons
  tbody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-update')) {
      const btn = e.target;
      const manager = btn.getAttribute('data-manager');
      const name = btn.getAttribute('data-name');
      
      btn.disabled = true;
      btn.textContent = 'Updating...';
      
      try {
        const result = await window.electronAPI.updatePackage(manager, name);
        if (result.success) {
          btn.textContent = 'Updated!';
          btn.style.backgroundColor = '#198754';
        } else {
          alert('Update failed: ' + result.error);
          btn.textContent = 'Failed';
          btn.style.backgroundColor = '#dc3545';
        }
      } catch (error) {
        alert('Error: ' + error.message);
        btn.textContent = 'Error';
      }
    }
  });
});
