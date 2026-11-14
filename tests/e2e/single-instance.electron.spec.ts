import { spawn, ChildProcess } from 'child_process';
import { test, expect, _electron as electron, ElectronApplication } from '@playwright/test';
import { requireElectronBinary } from './electron-binary';

/*
 * GLACIER runs as a single instance with a single window.
 *
 * This spec exercises the Electron main process, so it runs only under the
 * Electron project (see `electronOnlySpecs` in playwright.config.ts).
 */

const TIMEOUT_SPAWN = 30_000;

let secondInstance: ChildProcess | null = null;

function launchSecondInstance(): Promise<{ code: number | null; stderr: string }> {
  const electronPath = requireElectronBinary();
  return new Promise((resolve) => {
    const child = spawn(electronPath, ['.', '--no-sandbox'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    secondInstance = child;
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_SPAWN);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

async function stopSecondInstance() {
  const child = secondInstance;
  secondInstance = null;
  if (child && child.exitCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.on('exit', resolve));
  }
}

test.describe('single instance', () => {
  test('a second launch hands off to the running instance', async () => {
    test.setTimeout(90_000);
    requireElectronBinary(); // fail with an actionable message if not installed

    const app: ElectronApplication = await electron.launch({ args: ['.', '--no-sandbox'] });
    let mainStderr = '';
    const proc = await app.process();
    proc.stderr.on('data', (chunk) => (mainStderr += chunk.toString()));

    try {
      await app.firstWindow();
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
        1
      );

      // The second process must hand off and exit; the first must stay alive
      // with exactly one window.
      const secondLaunch = launchSecondInstance();
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
      await stopSecondInstance();
      await Promise.race([
        app.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      if (proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
    }
  });

  test('relaunching after the window is closed revives the app', async () => {
    // On Windows and Linux closing the window quits the app (window-all-closed),
    // so there is no running instance for a relaunch to hand off to.
    test.skip(
      process.platform !== 'darwin',
      'Closing the window quits the app on Windows and Linux'
    );
    test.setTimeout(90_000);
    requireElectronBinary();

    const app: ElectronApplication = await electron.launch({ args: ['.', '--no-sandbox'] });
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
      // If the second process became the primary instance it will not exit on
      // its own; make sure it cannot hold the single-instance lock for later tests.
      await stopSecondInstance();
      await Promise.race([
        app.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 10_000))
      ]);
      if (proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
    }
  });
});
