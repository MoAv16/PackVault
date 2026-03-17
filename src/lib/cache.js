const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class CacheManager {
  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'cache');
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getCachePath(manager) {
    return path.join(this.cacheDir, `${manager}.json`);
  }

  save(manager, data) {
    const filePath = this.getCachePath(manager);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  load(manager) {
    const filePath = this.getCachePath(manager);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  }
}

module.exports = new CacheManager();
