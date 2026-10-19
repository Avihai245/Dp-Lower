import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootstrapStaff, deleteUserByEmail } from '../scripts/bootstrap-admin';
import { sessionCookies } from './support/admin-auth';
import { createApplicant, type Applicant } from './portal.helpers';
import { RUN, cleanup, newIp } from './support/funnel';

/**
 * Automated accessibility checks (axe-core, WCAG 2.0/2.1 A and AA rules) on every kind of page of both apps, in both
 * languages: the firm website, its landing page and eligibility funnel (under /apply), the portal's public pages and,
 * signed in, the portal and the CRM.
 *
 * Colour contrast is reported but does not fail the run: the design's palette (bronze #a07a3c on cream, grey notes) is
 * kept exactly as designed and its contrast shortfalls are a decision for the firm's designer (see docs/AUDIT.md).
 * Everything else must be clean. This is a floor, not an audit: keyboard order, focus management, screen-reader
 * wording and the Israeli standard 5568 need a human pass.
 *
 *   pnpm exec playwright test e2e/a11y.spec.ts
 */
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
test.setTimeout(240_000);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Is the Hebrew edition of the funnel (/he/apply) on? Without it that address redirects to /apply. */
async function hebrewFunnel(): Promise<boolean> {
  const res = await fetch(`${MAIN}/he/apply`, { redirect: 'manual', headers: { accept: 'text/html' } });
  return res.status !== 307 && res.status !== 308;
}

interface Found {
  id: string;
  impact: string | null | undefined;
  nodes: number;
  sample: string;
}

async function scan(page: Page, url: string): Promise<{ contrast: number; others: Found[] }> {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(500);
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const contrast = result.violations.filter((v) => v.id === 'color-contrast').reduce((n, v) => n + v.nodes.length, 0);
  const others = result.violations
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: `${v.nodes[0]?.target.join(' ')} :: ${v.nodes[0]?.html.slice(0, 140)}` }));
  return { contrast, others };
}

const report: string[] = [];
test.afterAll(() => {
  // visible in the run output: how much contrast debt each page carries
  if (report.length) console.log(`\ncolour-contrast findings kept as designed:\n${report.join('\n')}`);
});

async function check(page: Page, url: string) {
  const { contrast, others } = await scan(page, url);
  if (contrast) report.push(`  ${String(contrast).padStart(3)}  ${url}`);
  expect(others, `${url}: ${JSON.stringify(others, null, 1)}`).toEqual([]);
}

const mainPages = ['/', '/about', '/services', '/services/german-citizenship', '/team', '/team/michael-decker', '/testimonials', '/insights', '/insights/german-citizenship-jewish-descent', '/media', '/contact', '/privacy', '/terms', '/accessibility'];

test.describe('firm website', () => {
  for (const prefix of ['', '/he']) {
    test(`${prefix || '/en'}: no violations outside colour contrast`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const path of mainPages) await check(page, MAIN + prefix + (path === '/' ? '' : path) || MAIN + '/');
      await ctx.close();
    });
  }
  test('phone width, both languages', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const prefix of ['', '/he']) for (const path of ['/', '/services/german-citizenship', '/contact']) await check(page, MAIN + prefix + (path === '/' ? '' : path) || MAIN + '/');
    await ctx.close();
  });
});

/** The landing page and the funnel pages that open without a lead (the later steps redirect to the quiz without one). */
const funnelPages = ['/apply', '/apply/privacy', '/apply/eligibility'];

test.describe('landing page and funnel (the firm site, /apply)', () => {
  for (const prefix of ['', '/he']) {
    test(`${prefix || '/en'}: public pages`, async ({ browser }) => {
      test.skip(prefix === '/he' && !(await hebrewFunnel()), 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
      const page = await ctx.newPage();
      for (const path of funnelPages) await check(page, MAIN + prefix + path);
      await ctx.close();
    });
  }
  test('phone width, both languages', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
    const page = await ctx.newPage();
    for (const prefix of (await hebrewFunnel()) ? ['', '/he'] : ['']) for (const path of ['/apply', '/apply/eligibility']) await check(page, MAIN + prefix + path);
    await ctx.close();
  });
});

test.describe('campaign (the portal\'s public pages)', () => {
  for (const prefix of ['', '/he']) {
    test(`${prefix || '/en'}: public pages`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: { 'x-forwarded-for': newIp() } });
      const page = await ctx.newPage();
      // its bare address is the sign-in page
      for (const path of ['/sign-in', '/link-expired']) await check(page, CAMPAIGN + prefix + path);
      await ctx.close();
    });
  }
});

test.describe('signed in', () => {
  let applicant: Applicant;
  const staff = `e2e-funnel-a11y-${RUN}@example.com`;
  const staffPassword = 'A11y-staff-pass-1';
  test.beforeAll(async () => {
    applicant = await createApplicant({ locale: 'en' });
    await bootstrapStaff({ email: staff, fullName: 'A11y Admin', password: staffPassword, role: 'admin' });
  });
  test.afterAll(async () => {
    await applicant.dispose();
    await deleteUserByEmail(staff).catch(() => undefined);
    await cleanup();
  });

  for (const prefix of ['', '/he']) {
    test(`${prefix || '/en'}: portal`, async ({ browser }) => {
      const ctx = await browser.newContext({ baseURL: CAMPAIGN, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', storageState: { cookies: applicant.cookies, origins: [] } });
      const page = await ctx.newPage();
      await page.addInitScript(() => localStorage.setItem('x', '1'));
      for (const path of ['/portal', '/portal/application', '/portal/documents']) await check(page, CAMPAIGN + prefix + path);
      await ctx.close();
    });

    test(`${prefix || '/en'}: CRM`, async ({ browser }) => {
      const cookies = await sessionCookies(CAMPAIGN, staff, staffPassword);
      const ctx = await browser.newContext({ baseURL: CAMPAIGN, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      for (const path of ['/admin', '/admin/inbox', '/admin/availability', '/admin/team', `/admin/leads/${applicant.leadId}`]) await check(page, CAMPAIGN + prefix + path);
      await ctx.close();
    });
  }
});
