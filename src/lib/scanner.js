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
}

module.exports = new Scanner();
