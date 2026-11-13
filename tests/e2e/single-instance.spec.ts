import { spawn } from 'child_process';
import { createRequire } from 'module';
import { test, expect, _electron as electron, ElectronApplication } from '@playwright/test';

/*
 * GLACIER runs as a single instance with a single window. On macOS, closing the
 * window leaves the app running; launching the app again must revive that window
 * rather than crash the existing instance (previously raised
 * "Object has been destroyed" and exited through the fatal error handler).
 */

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;

const TIMEOUT_SPAWN = 30_000;

function launchSecondInstance(): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(electronPath, ['.'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_SPAWN);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

test.describe('single instance', () => {
  test('relaunching after the window is closed revives the existing instance', async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('Electron'),
      'Electron only (single-instance behaviour lives in the main process)'
    );
    test.setTimeout(90_000);

    const app: ElectronApplication = await electron.launch({ args: ['.'] });
    let mainStderr = '';
    const proc = await app.process();
    proc.stderr.on('data', (chunk) => (mainStderr += chunk.toString()));

    try {
      await app.firstWindow();
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
        1
      );

      // Close the window but keep the app alive (macOS keeps running with no windows)
      await app.evaluate(({ BrowserWindow }) => {
        for (const win of BrowserWindow.getAllWindows()) win.close();
      });
      await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
        .toBe(0);
      expect(proc.exitCode).toBeNull();

      // Relaunch: the second process should hand off and exit...
      const secondLaunch = launchSecondInstance();
      // ...and the first instance should recreate its window.
      const revived = await app.waitForEvent('window', { timeout: 20_000 });
      expect(revived).toBeTruthy();

      const { code, stderr } = await secondLaunch;
      expect(code).toBe(0);
      expect(stderr).not.toContain('FATAL');

      await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
        .toBe(1);
      expect(proc.exitCode).toBeNull();
      expect(mainStderr).not.toContain('FATAL');
      expect(mainStderr).not.toContain('Object has been destroyed');
    } finally {
      await Promise.race([
        app.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      if (proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
    }
  });
});
