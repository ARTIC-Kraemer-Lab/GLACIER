import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

// Specs that exercise the Electron main process. There is no main process in
// web mode, so these are excluded from the Web projects and run only under the
// Electron project.
const electronOnlySpecs = '**/*.electron.spec.ts';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests inside a file must run sequentially
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1, // tests rebuild workflow library, so must run sequentially
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3030',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'Web (chromium)',
      testIgnore: electronOnlySpecs,
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'Web (firefox)',
      testIgnore: electronOnlySpecs,
      use: {
        browserName: 'firefox',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Firefox']
      }
    },
    {
      name: 'Web (webkit)',
      testIgnore: electronOnlySpecs,
      use: {
        browserName: 'webkit',
        baseURL: 'http://localhost:3030',
        ...devices['Desktop Safari']
      }
    },
    {
      // The desktop build is part of the product, so it is always tested. If the
      // Electron binary is missing the fixture fails with an actionable message
      // instead of the project being silently dropped from the run.
      name: 'Electron',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: {
    // In CI the app has already been built by the preceding workflow step;
    // rebuilding it here races the 60s webServer timeout on slow runners.
    command: isCI ? 'npm run serve' : 'npm run server',
    url: 'http://localhost:3030',
    reuseExistingServer: !isCI,
    timeout: 180_000
  }
});
