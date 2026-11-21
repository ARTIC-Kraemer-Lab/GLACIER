import { test, expect } from './fixtures';

const update = {
  currentVersion: '1.0.0',
  latestVersion: '1.1.0',
  releaseName: '1.1.0',
  releaseUrl: 'https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases/tag/v1.1.0'
};

test('shows the update banner, dismisses it, and shows it again after a restart', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('Electron'),
    'The update check goes through the web API in this test'
  );

  await page.route('**/api/check-for-update', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: update })
    })
  );
  await page.reload();

  const banner = page.locator('#update-available-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('1.1.0');
  await expect(banner).toContainText('1.0.0');

  await banner.getByRole('button').click();
  await expect(banner).toBeHidden();

  // Dismissal lasts for the session only: the next launch shows it again.
  await page.reload();
  await expect(page.locator('#update-available-banner')).toBeVisible();
});
