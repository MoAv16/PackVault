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
      const lines = stdout.split('\n');
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
          if (line.includes('Name') && line.includes('Id') && line.includes('Version')) {
            colIndices = [
              0, 
              line.indexOf('Id'), 
              line.indexOf('Version'), 
              line.indexOf('Available') !== -1 ? line.indexOf('Available') : line.indexOf('Source')
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

  async scanAll() {
    const results = await Promise.all([
      this.scanNpm(),
      this.scanPip(),
      this.scanWinget()
    ]);
    return results;
  }
}

module.exports = new Scanner();
