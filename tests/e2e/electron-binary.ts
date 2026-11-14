import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/*
 * Electron installs its binary lazily (postinstall). npm's `allowScripts`
 * policy can block that script, leaving `path.txt` absent, so resolve the
 * binary explicitly and fail with an actionable message rather than letting
 * Playwright report a cryptic launch error.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(__dirname, '../../node_modules/electron');

/** Path to the installed Electron executable, or null if it is not installed. */
export function getElectronBinary(): string | null {
  const pathFile = path.join(electronRoot, 'path.txt');
  if (!fs.existsSync(pathFile)) return null;

  // `path.txt` holds a path relative to the package's `dist/` directory, which
  // is how electron/index.js resolves it.
  const binary = path.join(electronRoot, 'dist', fs.readFileSync(pathFile, 'utf-8').trim());
  return fs.existsSync(binary) ? binary : null;
}

/** Path to the installed Electron executable, throwing if it is missing. */
export function requireElectronBinary(): string {
  const binary = getElectronBinary();
  if (!binary) {
    throw new Error(
      `Electron binary is not installed (looked in ${electronRoot}). ` +
        'Run: node node_modules/electron/install.js'
    );
  }
  return binary;
}
