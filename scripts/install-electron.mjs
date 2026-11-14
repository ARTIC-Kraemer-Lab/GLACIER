#!/usr/bin/env node
/*
 * Install the Electron binary required by the Electron Playwright project.
 *
 * `npm ci` cannot be relied on to run electron's postinstall (npm's allowScripts
 * policy skips dependency lifecycle scripts), and electron's own installer fails
 * silently when it encounters a partial `dist` directory or a truncated cached
 * archive left behind by an interrupted install. This does the download,
 * extraction and verification explicitly so CI fails with a useful message
 * instead of the Electron project going missing.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const electronRequire = createRequire(path.join(electronDir, 'package.json'));

const { downloadArtifact } = electronRequire('@electron/get');
const { version } = electronRequire(path.join(electronDir, 'package.json'));
const checksums = JSON.parse(fs.readFileSync(path.join(electronDir, 'checksums.json'), 'utf-8'));

const platform = process.env.npm_config_platform || process.platform;
const platformPath = {
  mas: 'Electron.app/Contents/MacOS/Electron',
  darwin: 'Electron.app/Contents/MacOS/Electron',
  linux: 'electron',
  freebsd: 'electron',
  openbsd: 'electron',
  win32: 'electron.exe'
}[platform];

if (!platformPath) {
  throw new Error(`Electron binaries are not available for platform ${platform}`);
}

let arch = process.env.npm_config_arch || process.arch;
if (
  platform === 'darwin' &&
  process.platform === 'darwin' &&
  arch === 'x64' &&
  !process.env.npm_config_arch
) {
  // Running under Rosetta: prefer the native arm64 build when available
  try {
    if (execSync('sysctl -in sysctl.proc_translated').toString().trim() === '1') arch = 'arm64';
  } catch {
    // Not translated; keep the reported arch
  }
}

const distDir = path.join(electronDir, 'dist');
const pathFile = path.join(electronDir, 'path.txt');

fs.rmSync(distDir, { recursive: true, force: true });
fs.rmSync(pathFile, { force: true });

/**
 * Extract with the platform's own tool. extract-zip hangs silently on some Node
 * versions when given a truncated archive, which is how this failed in CI.
 */
function extractArchive(zip, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const [command, args] =
    process.platform === 'win32'
      ? ['tar', ['-xf', zip, '-C', destination]]
      : ['unzip', ['-q', '-o', zip, '-d', destination]];
  try {
    execFileSync(command, args, { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`Failed to extract ${zip} with ${command}: ${err.message}`);
  }
}

console.log(`Installing Electron ${version} for ${platform}/${arch}`);
// Download into a fresh cache: an aborted install can leave a truncated archive
// in the shared cache, which makes extraction hang instead of failing.
const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-electron-'));
let zipPath;
try {
  zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    checksums,
    cacheRoot,
    force: true
  });
  console.log(`Downloaded ${zipPath}`);
  extractArchive(zipPath, distDir);
} finally {
  fs.rmSync(cacheRoot, { recursive: true, force: true });
}

const typeDefs = path.join(distDir, 'electron.d.ts');
if (fs.existsSync(typeDefs)) fs.renameSync(typeDefs, path.join(electronDir, 'electron.d.ts'));

fs.writeFileSync(pathFile, platformPath);

const binary = path.join(distDir, platformPath);
if (!fs.existsSync(binary)) {
  throw new Error(`Electron binary missing at ${binary} after installation`);
}
console.log(`Electron binary at ${binary}`);
