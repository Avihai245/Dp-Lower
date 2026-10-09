import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests of the CRM (/admin).
 *
 *   ADMIN_BASE_URL=http://localhost:3105 pnpm exec playwright test -c e2e/playwright.admin.config.ts
 *
 * Needs the campaign app running against the local Supabase (`pnpm --filter @dpl/campaign exec next dev -p 3105`,
 * apps/campaign/.env.local filled in). The specs create their own staff users, leads and inbox rows with the
 * service role and remove them again; they never touch other rows of the shared database.
 *
 * The same specs also run under the repository's own playwright.config.ts (`pnpm e2e`): the app they test is
 * `ADMIN_BASE_URL` when set, else the `baseURL` of whichever config runs them. Each worker builds and removes its own
 * world, and the specs keep to rows of their own (the weekly-template rows are split by spec: Friday 03:11 / 03:13
 * for access, Saturday 03:07 / 03:09 for availability), so two workers do not disturb each other. This config runs a
 * single worker, which is the quietest way on a database other people use at the same time.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /admin\..*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.ADMIN_BASE_URL ?? 'http://localhost:3105',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  },
  outputDir: '../test-results/admin',
});
