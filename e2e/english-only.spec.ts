import { expect, test } from '@playwright/test';
import { campaignIsBilingual } from './support/funnel';

/**
 * The campaign's public pages are English only (NEXT_PUBLIC_CAMPAIGN_LOCALES unset, the default). The Hebrew edition is
 * built but switched off: addresses under /he go to the English page, there is no language switch and no hreflang, a
 * visitor in Israel stays on English, and the firm's website points both of its languages at the English campaign.
 * These tests run against the default build and skip themselves on a bilingual one (language.spec.ts covers that).
 */
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const IL = { 'x-vercel-ip-country': 'IL' };
const html = { accept: 'text/html' };

test.beforeAll(async () => {
  test.skip(await campaignIsBilingual(), 'the campaign is bilingual in this build');
});

test('every address under /he goes to its English page, query kept; the staff area keeps Hebrew', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: CAMPAIGN, extraHTTPHeaders: IL });
  for (const [from, to] of [['/he', '/'], ['/he/eligibility?source=ad', '/eligibility?source=ad'], ['/he/privacy', '/privacy'], ['/he/sign-in', '/sign-in'], ['/he/portal', '/portal']] as const) {
    const res = await api.get(from, { maxRedirects: 0, headers: html });
    expect(res.status(), from).toBe(307);
    const target = new URL(res.headers()['location']!, CAMPAIGN);
    expect(target.pathname + target.search, from).toBe(to);
  }
  // the staff area is not one of the public pages: signed out it asks to sign in, in Hebrew
  const admin = await api.get('/he/admin', { maxRedirects: 0, headers: html });
  expect(admin.headers()['location']).toContain('/he/sign-in');
  await api.dispose();
});

test('the landing page: English even from Israel, no language switch, no hreflang, no Hebrew in the sitemap, robots or llms', async ({ browser, playwright }) => {
  const context = await browser.newContext({ baseURL: CAMPAIGN, extraHTTPHeaders: IL, locale: 'he-IL' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/localhost:3001\/$/);
  expect(await page.locator('html').evaluate((h) => ({ lang: h.lang, dir: h.dir }))).toEqual({ lang: 'en', dir: 'ltr' });
  await expect(page.locator('[data-lang-switch]')).toHaveCount(0);
  await expect(page.locator('link[rel=alternate][hreflang]')).toHaveCount(0);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /^http:\/\/localhost:3001\/?$/);
  await context.close();

  const api = await playwright.request.newContext({ baseURL: CAMPAIGN });
  const sitemap = await (await api.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/he');
  expect(sitemap).not.toContain('hreflang');
  expect(sitemap).toContain('<loc>');
  expect(await (await api.get('/robots.txt')).text()).not.toContain('/he/');
  for (const name of ['llms.txt', 'llms-full.txt']) {
    const res = await api.get(`/he/${name}`, { maxRedirects: 0 });
    expect(res.status(), name).toBe(308);
    expect(res.headers()['location']).toBe(`/${name}`);
    expect((await api.get(`/${name}`)).status()).toBe(200);
  }
  await api.dispose();
});

test('the firm website stays bilingual, and both of its languages link to the English campaign', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: MAIN, extraHTTPHeaders: { 'x-vercel-ip-country': 'US' } });
  for (const [path, hebrew] of [['/', false], ['/he', true], ['/contact', false], ['/he/contact', true]] as const) {
    const body = await (await api.get(path)).text();
    const links = [...body.matchAll(/href="(http[^"]*(?:eligibility|sign-in)[^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
    expect(links.length, path).toBeGreaterThan(0);
    for (const link of links.filter((l) => l.includes('source=main-site'))) {
      expect(link, `${path} (${hebrew ? 'Hebrew' : 'English'})`).not.toContain('/he/');
      expect(link).not.toContain('lang=');
    }
  }
  await api.dispose();
});
