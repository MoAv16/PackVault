let currentPackages = [];

document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan-all');
  const tbody = document.getElementById('packages-body');
  const statTotal = document.getElementById('stat-total');
  const searchInput = document.getElementById('search-input');

  function renderTable(packages) {
    if (packages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No packages found.</td></tr>';
      statTotal.textContent = '0';
      return;
    }

    statTotal.textContent = packages.length.toString();
    tbody.innerHTML = packages.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.version}</td>
        <td><span style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${p.manager}</span></td>
        <td>-</td>
      </tr>
    `).join('');
  }

  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Scanning system... This may take a moment.</td></tr>';
    
    try {
      // For now, we only scan NPM. Later this will call a master scan function.
      const result = await window.electronAPI.scanNpm();
      if (result.available) {
        currentPackages = result.packages;
        renderTable(currentPackages);
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">NPM not found on this system.</td></tr>';
      }
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color: red;">Error: ${error.message}</td></tr>`;
    } finally {
      btnScan.disabled = false;
      btnScan.textContent = 'Scan System';
    }
  });

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentPackages.filter(p => p.name.toLowerCase().includes(term));
    renderTable(filtered);
  });
});
