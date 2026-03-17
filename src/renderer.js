console.log('Renderer process started');

document.addEventListener('DOMContentLoaded', () => {
  const btnScanNpm = document.getElementById('btn-scan-npm');
  const outputDiv = document.getElementById('output');

  btnScanNpm.addEventListener('click', async () => {
    outputDiv.textContent = 'Scanning NPM packages... please wait.';
    btnScanNpm.disabled = true;
    
    try {
      const result = await window.electronAPI.scanNpm();
      outputDiv.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      outputDiv.textContent = 'Error: ' + error.message;
    } finally {
      btnScanNpm.disabled = false;
    }
  });
});
