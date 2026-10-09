import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { baseUrlFor, createWorld, destroyWorld, type World } from './admin-world';
import type { BrowserCookie } from './admin-auth';

/**
 * Fixtures of the CRM specs. `world` is created once per worker (staff in each role, an applicant, leads, an inbox) and
 * removed at the end; `adminPage`, `managerPage` and `applicantPage` are pages already signed in as those people.
 */

interface Fixtures {
  adminPage: Page;
  managerPage: Page;
  applicantPage: Page;
  inactivePage: Page;
  anonPage: Page;
}
interface WorkerFixtures {
  world: World;
}

async function signedIn(browser: import('@playwright/test').Browser, baseURL: string, cookies: BrowserCookie[]): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ baseURL, locale: 'en-US', viewport: { width: 1440, height: 900 } });
  if (cookies.length) await context.addCookies(cookies);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('[pageerror]', e.message.slice(0, 300)));
  return { page, context };
}

/**
 * `next dev` compiles a page the first time it is asked for, which can take a minute on a busy machine: ask for every
 * CRM page once, one after the other, before the tests start, so no test pays for (or times out on) a cold compile.
 */
async function warmUp(world: World): Promise<void> {
  const cookie = world.cookies.admin.map((c) => `${c.name}=${c.value}`).join('; ');
  const paths = ['/admin', '/admin/inbox', '/admin/availability', '/admin/team', `/admin/leads/${world.alpha.id}`, `/he/admin`, `/he/admin/leads/${world.alpha.id}`, '/he/admin/inbox', '/he/admin/availability'];
  for (const path of paths) {
    try {
      await fetch(world.baseURL + path, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(300_000) });
    } catch (e) {
      console.warn('[warm-up]', path, e instanceof Error ? e.message : e);
    }
  }
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  world: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const world = await createWorld(baseUrlFor(workerInfo.project.use.baseURL));
      try {
        await warmUp(world);
        await use(world);
      } finally {
        await destroyWorld(world);
      }
    },
    { scope: 'worker', timeout: 1_500_000 },
  ],
  adminPage: async ({ browser, world }, use) => {
    const { page, context } = await signedIn(browser, world.baseURL, world.cookies.admin);
    await use(page);
    await context.close();
  },
  managerPage: async ({ browser, world }, use) => {
    const { page, context } = await signedIn(browser, world.baseURL, world.cookies.manager);
    await use(page);
    await context.close();
  },
  applicantPage: async ({ browser, world }, use) => {
    const { page, context } = await signedIn(browser, world.baseURL, world.cookies.applicant);
    await use(page);
    await context.close();
  },
  inactivePage: async ({ browser, world }, use) => {
    const { page, context } = await signedIn(browser, world.baseURL, world.cookies.inactive);
    await use(page);
    await context.close();
  },
  anonPage: async ({ browser, world }, use) => {
    const { page, context } = await signedIn(browser, world.baseURL, []);
    await use(page);
    await context.close();
  },
});

export { expect };

/** Opens a lead's page and waits for the live-update channel, so a later change in the database is seen without a reload. */
export async function openLead(page: Page, id: string, prefix = ''): Promise<void> {
  await page.goto(`${prefix}/admin/leads/${id}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
}

export async function openList(page: Page, query = '', prefix = ''): Promise<void> {
  await page.goto(`${prefix}/admin${query}`);
  await expect(page.locator('[data-stats]')).toBeVisible();
  await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(1, { timeout: 15_000 });
}
