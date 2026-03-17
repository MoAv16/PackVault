let currentPackages = [];
let selectedPackages = new Set();
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan-all');
  const btnExport = document.getElementById('btn-export');
  const btnRunAnalyzer = document.getElementById('btn-run-analyzer');
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
    // Show/Hide Views
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

    if (currentFilter === 'health') {
        renderHealthReport();
        return;
    }

    if (currentFilter === 'blueprints') {
        renderBlueprints();
        return;
    }

    if (currentFilter === 'sandbox') {
        renderSandbox();
        return;
    }

    let filtered = currentPackages;
    
    if (currentFilter === 'collection') {
      filtered = currentPackages.filter(p => selectedPackages.has(p.name));
    } else if (['desktop', 'tools', 'runtimes', 'packages', 'system_core', 'enterprise'].includes(currentFilter)) {
      filtered = currentPackages.filter(p => p.category === currentFilter);
    }
    
    const term = searchInput.value.toLowerCase();
    if (term) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${currentFilter === 'collection' ? 'Collection is empty. Add packages from "All Packages".' : 'No packages found.'}</td></tr>`;
      statTotal.textContent = '0';
      return;
    }

    statTotal.textContent = filtered.length.toString();
    tbody.innerHTML = filtered.map(p => {
      const isOutdated = p.latest && p.latest !== p.version && p.latest !== 'unknown';
      const isSelected = selectedPackages.has(p.name);
      
      return `
        <tr class="row-clickable ${isSelected ? 'row-selected' : ''}" data-name="${p.name}">
          <td class="checkbox-cell">
            <span class="vault-toggle ${isSelected ? 'selected' : 'unselected'}" data-name="${p.name}">
              ${isSelected ? '🔖' : '📑'}
            </span>
          </td>
          <td class="pkg-name-cell">${p.name}</td>
          <td>${p.version}</td>
          <td class="${isOutdated ? 'outdated' : ''}">${p.latest || p.version}</td>
          <td><span style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${p.manager}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderHealthReport() {
    mainTopbar.style.display = 'flex';
    mainTableContainer.style.display = 'block';
    statTotal.textContent = 'Analysis';
    
    // We need to trigger the health check
    // Since scanner.analyzeHealth is in lib, we might need an IPC or just run it here if we have all data
    // For simplicity, let's assume we implement a basic version here or use currentPackages
    
    // Simple logic to find duplicates for the report
    const nameMap = new Map();
    currentPackages.forEach(p => {
        const n = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!nameMap.has(n)) nameMap.set(n, []);
        nameMap.get(n).push(p);
    });

    const issues = [];
    for (const [name, occurrences] of nameMap.entries()) {
        if (occurrences.length > 1) {
            issues.push({
                title: `Duplicate: ${occurrences[0].name}`,
                desc: `Installed via: ${occurrences.map(o => o.manager).join(', ')}`,
                severity: 'medium'
            });
        }
    }

    if (issues.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No issues found. Your system looks clean!</td></tr>`;
        return;
    }

    tbody.innerHTML = issues.map(iss => `
        <tr style="border-left: 4px solid ${iss.severity === 'high' ? '#dc3545' : '#ffc107'}">
            <td class="checkbox-cell">⚠️</td>
            <td colspan="2"><strong>${iss.title}</strong><br><small>${iss.desc}</small></td>
            <td>${iss.severity.toUpperCase()}</td>
            <td>-</td>
        </tr>
    `).join('');
  }

  function renderBlueprints() {
    statTotal.textContent = 'Blueprints';
    const blueprints = [
        { id: 'web', name: 'Web Developer', apps: ['Node.js', 'Git', 'VS Code', 'Docker'] },
        { id: 'data', name: 'Data Scientist', apps: ['Python', 'Jupyter', 'Anaconda', 'Pandas'] },
        { id: 'gaming', name: 'Gaming', apps: ['Steam', 'Discord', 'NVIDIA Control Panel', 'DirectX'] }
    ];

    tbody.innerHTML = blueprints.map(bp => {
        const missing = bp.apps.filter(app => !currentPackages.some(p => p.name.toLowerCase().includes(app.toLowerCase())));
        return `
            <tr>
                <td class="checkbox-cell">🧪</td>
                <td><strong>${bp.name} Stack</strong><br><small>Recommended: ${bp.apps.join(', ')}</small></td>
                <td colspan="2">${missing.length > 0 ? `<span style="color: #dc3545">Missing: ${missing.join(', ')}</span>` : '<span style="color: #198754">Complete!</span>'}</td>
                <td><button class="btn primary" style="padding: 5px 10px; font-size: 0.7rem;">Add Missing</button></td>
            </tr>
        `;
    }).join('');
  }

  function renderSandbox() {
    statTotal.textContent = 'Sandbox';
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="empty-state">
                <h3>Sandbox Creator</h3>
                <p>Selected Packages: ${selectedPackages.size}</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button class="btn primary" style="width: auto;">Generate Dockerfile</button>
                    <button class="btn primary" style="width: auto; background-color: #6f42c1;">Generate Windows Sandbox (.wsb)</button>
                </div>
            </td>
        </tr>
    `;
  }

  // Modal elements
  const modal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('close-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');
  const modalBtnAudit = document.getElementById('modal-btn-audit');
  const modalBtnUpdate = document.getElementById('modal-btn-update');
  let currentDetailPkg = null;

  // Row click for details
  tbody.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.vault-toggle')) return;
    
    const tr = e.target.closest('tr');
    if (!tr || tr.classList.contains('empty-state')) return;
    
    const name = tr.getAttribute('data-name');
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
        <hr style="margin: 15px 0; border:0; border-top:1px solid var(--border-color);">
        <div id="audit-results" style="font-family: monospace; background: var(--bg-color); padding: 15px; border-radius: 6px; display: none; white-space: pre-wrap; font-size: 0.8rem; border: 1px solid var(--border-color); color: #333;"></div>
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

  modalBtnUpdate.addEventListener('click', async () => {
    if (!currentDetailPkg) return;
    modalBtnUpdate.disabled = true;
    modalBtnUpdate.textContent = 'Updating...';
    try {
        const result = await window.electronAPI.updatePackage(currentDetailPkg.manager, currentDetailPkg.name);
        if (result.success) {
            modalBtnUpdate.textContent = 'Updated!';
            modalBtnUpdate.style.backgroundColor = '#198754';
        } else {
            alert('Update failed: ' + result.error);
            modalBtnUpdate.textContent = 'Update Package';
        }
    } catch(e) {
        alert('Error: ' + e.message);
        modalBtnUpdate.textContent = 'Update Package';
    } finally {
        modalBtnUpdate.disabled = false;
    }
  });

  // Load cache on startup
  async function loadCache() {
    try {
      const cachedData = await window.electronAPI.getCache();
      if (cachedData && cachedData.length > 0) {
        currentPackages = cachedData;
        btnRunAnalyzer.style.display = 'block';
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
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Scanning... This may take a few seconds.</td></tr>';
    
    try {
      const results = await window.electronAPI.scanAll(currentFilter);
      
      if (currentFilter !== 'all' && !['collection', 'settings', 'blueprints', 'sandbox', 'health'].includes(currentFilter)) {
        const scannedManager = results[0]?.manager;
        if (scannedManager && scannedManager !== 'consolidated') {
          currentPackages = currentPackages.filter(p => p.manager !== scannedManager);
        }
      }
      
      if (results[0]?.manager === 'consolidated') {
        currentPackages = results[0].packages;
      } else {
        results.forEach(res => {
          if (res && res.available && res.packages) {
            currentPackages = currentPackages.concat(res.packages);
          }
        });
      }
      
      btnRunAnalyzer.style.display = 'block';
      renderTable();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = 'Scan System';
    }
  });

  // Analyzer Button
  btnRunAnalyzer.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      const healthLi = document.querySelector('li[data-view="health"]');
      if (healthLi) healthLi.classList.add('active');
      currentFilter = 'health';
      renderTable();
  });

  // Vault Selection Logic
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
});
