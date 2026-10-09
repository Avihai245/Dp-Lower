import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. By default they run against servers you started (`pnpm --filter @dpl/campaign start -p 3001`,
 * `pnpm --filter @dpl/main start -p 3000` after `pnpm build`). Set E2E_START_SERVERS=1 to let Playwright start them.
 */
const campaign = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const main = process.env.MAIN_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: campaign,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // deterministic pages: no video or analytics
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_START_SERVERS
    ? [
        { command: 'pnpm --filter @dpl/campaign start', url: campaign, reuseExistingServer: true, timeout: 120_000 },
        { command: 'pnpm --filter @dpl/main start', url: main, reuseExistingServer: true, timeout: 120_000 },
      ]
    : undefined,
});
