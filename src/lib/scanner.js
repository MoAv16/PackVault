const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class Scanner {
  /**
   * Checks if a command exists in the system PATH.
   */
  async checkCommand(cmd) {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    try {
      await execAsync(checkCmd);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Assigns a logical category to a package based on its name and manager.
   */
  categorize(pkg) {
    const name = pkg.name.toLowerCase();
    const mgr = pkg.manager;

    // Smart Exclusion (Drivers, Core, Redists)
    const coreKeywords = ['intel', 'nvidia', 'amd ', 'realtek', 'microsoft visual c++', 'update health tools', 'windows desktop runtime', 'edge webview'];
    if (coreKeywords.some(k => name.includes(k))) return 'system_core';

    // Enterprise / Company Portal
    const enterpriseKeywords = ['cisco', 'citrix', 'vmware', 'fortinet', 'vpn', 'endpoint', 'globalprotect'];
    if (enterpriseKeywords.some(k => name.includes(k)) && mgr === 'system') return 'enterprise';

    const runtimeKeywords = ['python', 'node.js', 'nodejs', 'java', 'openjdk', 'dotnet', 'rust', 'go-lang', 'ruby', 'perl', 'php'];
    if (runtimeKeywords.some(k => name.includes(k))) return 'runtimes';

    if (mgr === 'system') return 'desktop';
    
    if (mgr === 'npm' || mgr === 'pip') return 'packages';

    if (mgr === 'scoop' || mgr === 'choco' || mgr === 'winget') {
        const desktopKeywords = [
          'browser', 'client', 'desktop', 'player', 'office', 'studio', 'workstation', 
          'chrome', 'firefox', 'discord', 'spotify', 'code', 'visual', 'adobe', 
          'reader', 'editor', 'viewer', 'player', 'manager', 'app', 'tool'
        ];
        
        // If it's Winget or Choco, it's very often a GUI app unless it's explicitly a tool
        if ((mgr === 'winget' || mgr === 'choco') && !name.includes('cli') && !name.includes('sdk')) {
          return 'desktop';
        }

        if (desktopKeywords.some(k => name.includes(k))) return 'desktop';
        return 'tools';
    }

    return 'tools';
  }

  /**
   * Runs a security audit for supported managers.
   */
  async runAudit(manager) {
    try {
      if (manager === 'npm') {
        const { stdout } = await execAsync('npm audit -g --json');
        return JSON.parse(stdout);
      } else if (manager === 'pip') {
        const { stdout, stderr } = await execAsync('pip check');
        return { output: stdout || stderr };
      }
      return { message: 'No security audit available for this manager.' };
    } catch (error) {
      if (manager === 'npm' && error.stdout) {
         try { return JSON.parse(error.stdout); } catch(e) { return { error: 'Parse failed', raw: error.stdout }; }
      }
      return { error: error.message };
    }
  }

  /**
   * Scans global npm packages.
   */
  async scanNpm() {
    const isAvailable = await this.checkCommand('npm');
    if (!isAvailable) return { manager: 'npm', available: false, packages: [] };

    try {
      const { stdout } = await execAsync('npm list -g --json --depth=0');
      const data = JSON.parse(stdout);
      
      const packages = [];
      if (data.dependencies) {
        for (const [name, info] of Object.entries(data.dependencies)) {
          const pkg = {
            name,
            version: info.version || 'unknown',
            latest: info.version || 'unknown',
            manager: 'npm'
          };
          pkg.category = this.categorize(pkg);
          packages.push(pkg);
        }
      }
      
      return { manager: 'npm', available: true, packages };
    } catch (error) {
      console.error('Error scanning npm:', error);
      return { manager: 'npm', available: true, packages: [], error: error.message };
    }
  }

  async scanPip() {
    const isAvailable = await this.checkCommand('pip');
    if (!isAvailable) return { manager: 'pip', available: false, packages: [] };

    try {
      const { stdout } = await execAsync('pip list --format=json');
      const data = JSON.parse(stdout);
      
      const packages = data.map(p => {
        const pkg = {
          name: p.name,
          version: p.version,
          latest: p.version,
          manager: 'pip'
        };
        pkg.category = this.categorize(pkg);
        return pkg;
      });
      
      return { manager: 'pip', available: true, packages };
    } catch (error) {
      console.error('Error scanning pip:', error);
      return { manager: 'pip', available: true, packages: [], error: error.message };
    }
  }

  async scanWinget() {
    const isAvailable = await this.checkCommand('winget');
    if (!isAvailable) return { manager: 'winget', available: false, packages: [] };

    try {
      const { stdout } = await execAsync('chcp 65001 >nul & winget list');
      
      const lines = stdout.split(/\r?\n/);
      const packages = [];
      let startParsing = false;
      let colIndices = [];

      for (let line of lines) {
        if (line.startsWith('---')) {
          startParsing = true;
          continue;
        }
        if (!startParsing) {
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('name') && (lowerLine.includes('id')) && lowerLine.includes('version')) {
            colIndices = [
              0, 
              line.toUpperCase().indexOf('ID'), 
              line.toLowerCase().indexOf('version'), 
              line.toLowerCase().includes('available') ? line.toLowerCase().indexOf('available') : 
              (line.toLowerCase().includes('verfügbar') ? line.toLowerCase().indexOf('verfügbar') : 
              (line.toLowerCase().includes('source') ? line.toLowerCase().indexOf('source') : 
              (line.toLowerCase().includes('quelle') ? line.toLowerCase().indexOf('quelle') : line.length)))
            ];
          }
          continue;
        }

        if (line.trim().length === 0) continue;
        
        if (colIndices.length >= 3) {
          const name = line.substring(colIndices[0], colIndices[1]).trim();
          const current = line.substring(colIndices[2], colIndices[3]).trim();
          const available = line.substring(colIndices[3]).trim().split(/\s+/)[0]; // Only take the first word (version)
          
          if (name) {
            const pkg = {
              name,
              version: current,
              latest: available || current,
              manager: 'winget'
            };
            pkg.category = this.categorize(pkg);
            packages.push(pkg);
          }
        }
      }
      
      return { manager: 'winget', available: true, packages };
    } catch (error) {
      console.error('Error scanning winget:', error);
      return { manager: 'winget', available: true, packages: [], error: error.message };
    }
  }

  async scanScoop() {
    const isAvailable = await this.checkCommand('scoop');
    if (!isAvailable) return { manager: 'scoop', available: false, packages: [] };

    try {
      const { stdout } = await execAsync('scoop list');
      const lines = stdout.split('\n');
      const packages = [];
      let startParsing = false;

      for (let line of lines) {
        if (line.startsWith('Installed apps')) {
          startParsing = true;
          continue;
        }
        if (!startParsing || line.trim().length === 0 || line.startsWith('---')) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pkg = {
            name: parts[0],
            version: parts[1],
            latest: parts[1],
            manager: 'scoop'
          };
          pkg.category = this.categorize(pkg);
          packages.push(pkg);
        }
      }
      
      return { manager: 'scoop', available: true, packages };
    } catch (error) {
      console.error('Error scanning scoop:', error);
      return { manager: 'scoop', available: true, packages: [], error: error.message };
    }
  }

  async scanChoco() {
    const isAvailable = await this.checkCommand('choco');
    if (!isAvailable) return { manager: 'choco', available: false, packages: [] };

    try {
      const { stdout } = await execAsync('choco list --local-only --limit-output');
      const lines = stdout.split('\n');
      const packages = [];

      for (let line of lines) {
        if (line.trim().length === 0) continue;
        const parts = line.trim().split('|');
        if (parts.length >= 2) {
          const pkg = {
            name: parts[0],
            version: parts[1],
            latest: parts[1],
            manager: 'choco'
          };
          pkg.category = this.categorize(pkg);
          packages.push(pkg);
        }
      }
      
      return { manager: 'choco', available: true, packages };
    } catch (error) {
      console.error('Error scanning choco:', error);
      return { manager: 'choco', available: true, packages: [], error: error.message };
    }
  }

  async scanSystemPrograms() {
    if (process.platform !== 'win32') return { manager: 'system', available: false, packages: [] };

    const psScript = `
      $paths = @(
        'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
        'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
      );
      $results = foreach ($path in $paths) {
        Get-ItemProperty $path -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -and !$_.SystemComponent -and !$_.ParentKeyName } |
        Select-Object DisplayName, DisplayVersion
      };
      $results | ConvertTo-Json
    `.replace(/\n/g, '').trim();

    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`);
      if (!stdout || stdout.trim() === "") return { manager: 'system', available: true, packages: [] };
      
      const rawData = JSON.parse(stdout);
      const data = Array.isArray(rawData) ? rawData : [rawData];
      
      const packages = data
        .filter(p => p.DisplayName)
        .map(p => {
          const pkg = {
            name: p.DisplayName,
            version: p.DisplayVersion || 'unknown',
            latest: p.DisplayVersion || 'unknown',
            manager: 'system'
          };
          pkg.category = this.categorize(pkg);
          return pkg;
        });
      
      const uniquePackages = Array.from(new Map(packages.map(item => [item.name, item])).values());
      
      return { manager: 'system', available: true, packages: uniquePackages };
    } catch (error) {
      console.error('Error scanning system programs:', error);
      return { manager: 'system', available: true, packages: [], error: error.message };
    }
  }

  async scanAll() {
    const results = await Promise.all([
      this.scanNpm(),
      this.scanPip(),
      this.scanWinget(),
      this.scanScoop(),
      this.scanChoco(),
      this.scanSystemPrograms()
    ]);
    return results;
  }
}

module.exports = new Scanner();
