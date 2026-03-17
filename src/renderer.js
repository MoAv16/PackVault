let currentPackages = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan-all');
  const tbody = document.getElementById('packages-body');
  const statTotal = document.getElementById('stat-total');
  const searchInput = document.getElementById('search-input');
  const navItems = document.querySelectorAll('nav li');

  function renderTable() {
    let filtered = currentPackages;
    
    if (currentFilter !== 'all') {
      filtered = currentPackages.filter(p => p.manager === currentFilter);
    }
    
    const term = searchInput.value.toLowerCase();
    if (term) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No packages found.</td></tr>';
      statTotal.textContent = '0';
      return;
    }

    statTotal.textContent = filtered.length.toString();
    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.version}</td>
        <td><span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${p.manager}</span></td>
        <td>
          <button class="btn primary btn-update" data-manager="${p.manager}" data-name="${p.name}" style="padding: 4px 8px; font-size: 0.8rem;">Update</button>
        </td>
      </tr>
    `).join('');
  }

  // Sidebar Filter Logic
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      navItems.forEach(nav => nav.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-view');
      renderTable();
    });
  });

  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Scanning system... This may take a few seconds.</td></tr>';
    
    try {
      const results = await window.electronAPI.scanAll();
      
      currentPackages = [];
      results.forEach(res => {
        if (res.available && res.packages) {
          currentPackages = currentPackages.concat(res.packages);
        }
      });
      
      renderTable();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = 'Scan System';
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
          btn.style.backgroundColor = '#198754'; // success green
        } else {
          alert('Update failed: ' + result.error);
          btn.textContent = 'Failed';
          btn.style.backgroundColor = '#dc3545'; // danger red
        }
      } catch (error) {
        alert('Error: ' + error.message);
        btn.textContent = 'Error';
      }
    }
  });
});
