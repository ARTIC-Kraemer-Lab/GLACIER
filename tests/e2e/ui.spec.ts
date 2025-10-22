import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import cssEscape from 'css.escape';
import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import { fileURLToPath } from 'url';

/*
 * Insert 'await page.pause();' to debug tests in playwright inspector
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMEOUT_10s = 10_000;
const TIMEOUT_30s = 30_000;
const TIMEOUT_60s = 60_000;


async function waitForLogLine(page: Page, text: string | RegExp, timeout = 60000) {
  await expect(page.locator('#logMessage > p').filter({ hasText: text })).toBeVisible({ timeout });
}

test('show title', async ({ page }) => {
  await expect(page).toHaveTitle(/GLACIER/i);
});

test('clone a repository', async ({ page }) => {
  // === Setup temporary library path ==================================================

  // Navigate to Settings page
  await page.click('#sidebar-settings-button');

  // Set library path to a temporary folder
  const glacier_path = path.resolve(path.join(os.tmpdir(), 'GLACIER-' + Date.now().toString()));
  fs.rmSync(glacier_path, { recursive: true, force: true });
  expect(fs.existsSync(glacier_path)).toBe(false);
  const library_path = path.resolve(path.join(glacier_path, 'library'));
  fs.mkdirSync(library_path, { recursive: true }); // rebuild
  await page.fill('#settings-collections-path', `${library_path}`);

  // Use English language for this test
  await page.click('#settings-language-select');
  await page.getByRole('option', { name: 'English' }).click();

  // === Clone a repository ============================================================

  // Check that the Library is empty
  await page.click('#sidebar-library-button');
  expect(await page.locator('[id^="collections-sync-"]').count()).toBe(0);

  // --- Navigate to Hub page
  await page.click('#sidebar-hub-button');

  // Clone repository
  const repo_owner = 'jsbrittain';
  const repo_name = 'workflow-runner-test-nextflow';
  await page.fill('#collections-repo-url', `${repo_owner}/${repo_name}`);
  await page.click('#collections-clone-button');
  await waitForLogLine(page, new RegExp(`^Cloned main to `));

  // --- Navigate to Library page
  await page.click('#sidebar-library-button');
  for (let i = 0; i < 30; i++) {
    if ((await page.locator(`[id="collections-sync-${cssEscape(repo_name)}"]`).count()) == 1) {
      break;
    }
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('#sidebar-library-button');
    await page.waitForTimeout(1000);
  }

  // Find the cloned workflow
  await expect(page.locator('h6').filter({ hasText: 'workflow-runner-test-nextflow' })).toBeVisible(
    { timeout: TIMEOUT_10s }
  );

  // Sync the repository
  await page.click(`#collections-sync-${cssEscape(repo_name)}`);
  await waitForLogLine(page, 'Repository synced');

  // Create an instance of the workflow (redirects to Parameters page)
  await page.click(`#collections-run-${cssEscape(repo_name)}`);
  // 'Launch Workflow' button should now be visible
  await expect(page.getByRole('button', { name: 'Launch Workflow' })).toBeVisible({
    timeout: TIMEOUT_10s
  });
});

test('launch local workflow', async ({ page }) => {
  const local_workflow_path = path.resolve(
    path.join(__dirname, '..', 'test-data', 'sleep@undefined')
  );

  // Navigate to Settings page
  await page.click('#sidebar-settings-button');

  // Get the library path
  const library_path = await page.inputValue('#settings-collections-path');
  const dest_path = path.join(library_path, 'workflows', 'local', 'sleep@undefined');

  // Copy the local workflow to the library path
  fs.cpSync(local_workflow_path, dest_path, { recursive: true });

  // Check folder exists
  if (!fs.existsSync(dest_path)) {
    throw new Error(`Failed to copy local workflow to library: ${dest_path}`);
  }

  // Force refresh of workflows (change collections-path twice)
  await page.fill('#settings-collections-path', library_path + '_temp');
  await page.fill('#settings-collections-path', library_path);

  // --- Navigate to Library page
  await page.click('#sidebar-library-button');
  const repo_name = 'sleep';

  // Find the cloned workflow
  await expect(page.locator('h6').filter({ hasText: repo_name })).toBeVisible({
    timeout: TIMEOUT_10s
  });

  // Create an instance of the workflow (redirects to Parameters page)
  await page.click(`#collections-run-${cssEscape(repo_name)}`);

  // Set sleep time parameter
  await page.getByLabel('Sleep Time').fill('5'); // 5 second sleep
  await page.getByLabel('Sleep Time').blur();

  // Launch workflow
  await page.getByRole('button', { name: 'Launch Workflow' }).click();

  // Check that workflow completes (3 second workflow)
  await expect(page.locator('h6').filter({ hasText: 'Status: Completed' })).toBeVisible({
    timeout: TIMEOUT_30s
  });
});
