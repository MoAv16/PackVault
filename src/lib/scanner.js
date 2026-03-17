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
   * Scans global npm packages.
   * Returns an array of package objects.
   */
  async scanNpm() {
    const isAvailable = await this.checkCommand('npm');
    if (!isAvailable) return { manager: 'npm', available: false, packages: [] };

    try {
      // --depth=0 to only get top-level global packages
      const { stdout } = await execAsync('npm list -g --json --depth=0');
      const data = JSON.parse(stdout);
      
      const packages = [];
      if (data.dependencies) {
        for (const [name, info] of Object.entries(data.dependencies)) {
          packages.push({
            name,
            version: info.version || 'unknown',
            manager: 'npm'
          });
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
      
      const packages = data.map(p => ({
        name: p.name,
        version: p.version,
        manager: 'pip'
      }));
      
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
      // Use chcp 65001 to ensure UTF-8 output, then run winget list
      const { stdout } = await execAsync('chcp 65001 >nul & winget list');
      
      // Parse winget text output (Name, Id, Version, Available, Source)
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
          // Find column headers to know where to split
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
        
        // Ensure we have columns to parse
        if (colIndices.length >= 3) {
          const name = line.substring(colIndices[0], colIndices[1]).trim();
          const version = line.substring(colIndices[2], colIndices[3] || line.length).trim();
          
          if (name) {
            packages.push({
              name,
              version,
              manager: 'winget'
            });
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
      // scoop export returns a list of installed apps
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
          packages.push({
            name: parts[0],
            version: parts[1],
            manager: 'scoop'
          });
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
          packages.push({
            name: parts[0],
            version: parts[1],
            manager: 'choco'
          });
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
        "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
      )
      $results = foreach ($path in $paths) {
        Get-ItemProperty $path -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -and !$_.SystemComponent -and !$_.ParentKeyName } |
        Select-Object DisplayName, DisplayVersion
      }
      $results | ConvertTo-Json
    `;

    try {
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`);
      if (!stdout || stdout.trim() === "") return { manager: 'system', available: true, packages: [] };
      
      const rawData = JSON.parse(stdout);
      const data = Array.isArray(rawData) ? rawData : [rawData];
      
      // Filter out empty names and map to our format
      const packages = data
        .filter(p => p.DisplayName)
        .map(p => ({
          name: p.DisplayName,
          version: p.DisplayVersion || 'unknown',
          manager: 'system'
        }));
      
      // Remove duplicates by name
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
