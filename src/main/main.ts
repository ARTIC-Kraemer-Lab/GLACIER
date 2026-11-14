import { app, screen, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerIpcHandlers, call } from './ipc-handlers.js';
import { Collection } from './collection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;
let quitting = false;

/**
 * Append a crash report to the log directory so failures can be diagnosed in
 * packaged builds, where console output is not visible.
 */
function writeCrashLog(error: Error, type: string) {
  try {
    const logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    const windowState = win ? (win.isDestroyed() ? 'destroyed' : 'alive') : 'none';
    const entry = [
      `[${new Date().toISOString()}] ${type}`,
      `window: ${windowState}`,
      error?.stack ?? String(error),
      '',
      ''
    ].join('\n');
    fs.appendFileSync(path.join(logDir, 'crash.log'), entry, 'utf-8');
  } catch {
    // Never let logging interfere with error handling
  }
}

/**
 * Attempt to gracefully shut down running processes and save state on catastrophic failure.
 */
async function gracefulCrash(error: Error, type: 'uncaughtException' | 'unhandledRejection') {
  console.error(`FATAL [${type}]:`, error);
  writeCrashLog(error, type);

  // The application is already shutting down; do not interrupt the quit sequence.
  if (quitting) return;
  quitting = true;

  try {
    const col = Collection.getInstance();
    for (const inst of col.workflow_instances) {
      for (const desc of inst.processes) {
        try {
          if (desc.containerId) {
            const { docker } = await import('../runners/docker/docker.js');
            const container = docker.getContainer(desc.containerId);
            await container.stop({ t: 5 });
          } else {
            // Send SIGTERM to process group
            try {
              process.kill(-desc.pid, 'SIGTERM');
            } catch {
              /* already dead */
            }
            try {
              process.kill(desc.pid, 'SIGTERM');
            } catch {
              /* already dead */
            }
          }
        } catch {
          // Best effort
        }
      }
    }
  } catch {
    // Best effort during crash recovery
  }

  dialog.showErrorBox(
    'GLACIER - Fatal Error',
    `A fatal ${type === 'uncaughtException' ? 'exception' : 'error'} occurred:\n\n${error.message}\n\nThe application will now exit.`
  );

  process.exit(1);
}

process.on('uncaughtException', (error) => {
  void gracefulCrash(error, 'uncaughtException');
});

// Unhandled rejections are frequently transient (e.g. an Electron object being
// used after its window closed). Log them with a stack trace, but do not treat
// them as fatal: doing so kills running workflows for recoverable errors.
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('Unhandled rejection:', error);
  writeCrashLog(error, 'unhandledRejection');
});

/**
 * Return the one live window, or null if none currently exists. Destroyed
 * windows are never returned, and the cached reference is cleared when stale.
 */
function getLiveWindow(): BrowserWindow | null {
  if (win && !win.isDestroyed()) return win;
  win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null;
  return win;
}

/**
 * Bring the existing window to the front, or create it if it has been closed.
 * GLACIER runs as a single instance with a single window.
 */
function focusOrCreateWindow() {
  if (quitting) return;

  const existing = getLiveWindow();
  if (!existing) {
    createWindow();
    return;
  }

  if (existing.isMinimized()) existing.restore();
  if (!existing.isVisible()) existing.show();
  existing.focus();
}

function createWindow(): void {
  if (quitting) return;

  const existing = getLiveWindow();
  if (existing) {
    focusOrCreateWindow();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const created = new BrowserWindow({
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win = created;

  created.on('closed', () => {
    if (win === created) win = null;
  });

  // Never allow additional windows to be opened from the renderer; external
  // links are handed to the OS instead.
  created.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const indexPath = path.join(__dirname, '../renderer/index.html');
  created.loadFile(indexPath);
  created.webContents.on('did-fail-load', () => {
    console.error('Failed to load index.html');
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // Another instance is already running (or launching). Hand off to it and exit
  // without initialising anything: no window, no IPC handlers, no Collection.
  app.quit();
} else {
  app.on('second-instance', () => {
    focusOrCreateWindow();
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    createWindow();
    const resourceRoot = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'bundle'
    );
    registerIpcHandlers(resourceRoot);

    app.on('activate', () => {
      focusOrCreateWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  ipcMain.handle('pick-file', async (_evt, opts?: { filters?: Electron.FileFilter[] }) => {
    return call(async () => {
      const options: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        filters: opts?.filters
      };
      const parent = getLiveWindow();
      const res = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      return res.canceled ? null : (res.filePaths[0] ?? null);
    });
  });

  ipcMain.handle('pick-directory', async () => {
    return call(async () => {
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory']
      };
      const parent = getLiveWindow();
      const res = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      return res.canceled ? null : (res.filePaths[0] ?? null);
    });
  });

  ipcMain.handle('show-save-dialog', async (_evt, opts: Electron.SaveDialogOptions) => {
    return call(async () => {
      const parent = getLiveWindow();
      const res = parent
        ? await dialog.showSaveDialog(parent, opts)
        : await dialog.showSaveDialog(opts);
      return res.canceled ? null : res.filePath;
    });
  });

  ipcMain.handle('write-text-file', async (_evt, filePath: string, content: string) => {
    return call(async () => {
      fs.writeFileSync(filePath, content, 'utf-8');
    });
  });

  ipcMain.handle('read-text-file', async (_evt, filePath: string) => {
    return call(async () => {
      return fs.readFileSync(filePath, 'utf-8');
    });
  });
}
