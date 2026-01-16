// scripts/after-pack.js
const fs = require('fs');
const path = require('path');

async function afterPack(context) {
  try {
    const appOutDir = context.appOutDir;
    console.log('afterPack running on', appOutDir);

    // resources path inside the built app
    const resourcesDir =
      process.platform === 'darwin'
        ? path.join(appOutDir, 'Contents', 'Resources', 'bundle')
        : path.join(appOutDir, 'resources', 'bundle');

    if (!fs.existsSync(resourcesDir)) {
      console.log('No bundle directory at', resourcesDir);
      return;
    }

    // make executables in jre/bin executable
    function chmodRecursive(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir)) {
        const fp = path.join(dir, entry);
        const st = fs.statSync(fp);
        if (st.isDirectory()) chmodRecursive(fp);
        else {
          // mark common bin files executable
          if (/[/\\]bin[/\\]/.test(fp) || /\/bin\/java$/.test(fp) || /\\bin\\java.exe$/.test(fp)) {
            try {
              fs.chmodSync(fp, 0o755);
            } catch (e) {
              console.warn('chmod failed', fp, e);
            }
          }
        }
      }
    }

    chmodRecursive(resourcesDir);
    console.log('afterPack chmod done');
  } catch (err) {
    console.error('afterPack error:', err);
    throw err;
  }
}

module.exports = afterPack;
module.exports.default = afterPack;
exports.default = afterPack;
