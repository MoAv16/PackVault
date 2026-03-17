const sudo = require('sudo-prompt');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const options = {
  name: 'PackVault'
};

class Updater {
  /**
   * Run a command with elevated privileges.
   */
  async runElevated(command) {
    return new Promise((resolve, reject) => {
      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async updatePackage(manager, packageName) {
    let command = '';
    let requiresAdmin = false;

    switch (manager) {
      case 'npm':
        // Global npm installs often need admin on Windows/Linux
        command = `npm install -g ${packageName}@latest`;
        requiresAdmin = true; 
        break;
      case 'pip':
        command = `pip install --upgrade ${packageName}`;
        // pip might not need admin if in user space, but for global system we elevate
        requiresAdmin = true;
        break;
      case 'winget':
        command = `winget upgrade --exact --id ${packageName} --accept-source-agreements --accept-package-agreements`;
        requiresAdmin = true;
        break;
      default:
        throw new Error(`Unsupported manager: ${manager}`);
    }

    try {
      if (requiresAdmin) {
        await this.runElevated(command);
      } else {
        await execAsync(command);
      }
      return { success: true, message: `Successfully updated ${packageName}` };
    } catch (error) {
      console.error(`Failed to update ${packageName}:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }
}

module.exports = new Updater();
