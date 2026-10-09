import { expect, test, type Browser } from '@playwright/test';

/**
 * The language a visitor starts in, and the language switch, on both sites.
 *   - a visitor in Israel (the platform's country header) who opens an English address lands on the Hebrew edition;
 *     anyone else lands on English;
 *   - the switch changes the page to the other language on the same page, in both directions, and remembers the choice:
 *     an Israeli visitor who picks English keeps English, a visitor elsewhere who picks Hebrew gets Hebrew next time;
 *   - search engines are never redirected.
 * The country header is what Vercel sets in production; the tests send it themselves.
 */
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const IL = { 'x-vercel-ip-country': 'IL' };
const US = { 'x-vercel-ip-country': 'US' };

async function visitor(browser: Browser, headers: Record<string, string>, baseURL: string) {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: headers, viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() };
}
const dirOf = (page: import('@playwright/test').Page) => page.locator('html').evaluate((h) => ({ lang: h.lang, dir: h.dir }));

test.describe('firm website', () => {
  test('a visitor in Israel lands on Hebrew, a visitor elsewhere on English, and a crawler is left alone', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: MAIN, extraHTTPHeaders: IL });
    const res = await il.get('/services/german-citizenship?utm_source=x', { maxRedirects: 0, headers: { accept: 'text/html' } });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/he/services/german-citizenship?utm_source=x');
    const bot = await il.get('/about', { maxRedirects: 0, headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
    expect(bot.status()).toBe(200);
    const us = await playwright.request.newContext({ baseURL: MAIN, extraHTTPHeaders: US });
    expect((await us.get('/about', { maxRedirects: 0, headers: { accept: 'text/html' } })).status()).toBe(200);
    await il.dispose();
    await us.dispose();
  });

  test('from Israel: Hebrew by default; the switch gives English on the same page and the choice sticks; and back', async ({ browser }) => {
    const { context, page } = await visitor(browser, IL, MAIN);
    await page.goto('/services/german-citizenship');
    await expect(page).toHaveURL(/\/he\/services\/german-citizenship$/);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });

    const english = page.locator('[role=group] a[hreflang=en]').first();
    await english.click();
    await expect(page).toHaveURL(/localhost:3000\/services\/german-citizenship$/);
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    // the choice is remembered: the home page and another page stay English, although the visitor is in Israel
    await page.goto('/');
    await expect(page).toHaveURL(/localhost:3000\/$/);
    await page.goto('/about');
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });

    // and back to Hebrew with the same switch
    await page.locator('[role=group] a[hreflang=he]').first().click();
    await expect(page).toHaveURL(/\/he\/about$/);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
    // a visitor who chose Hebrew explicitly gets Hebrew on the English home address
    await page.goto('/');
    await expect(page).toHaveURL(/\/he$/);
    await context.close();
  });

  test('from abroad: English by default; the switch gives Hebrew on deep pages (team, article) and remembers it', async ({ browser }) => {
    const { context, page } = await visitor(browser, US, MAIN);
    await page.goto('/about');
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    for (const path of ['/team', '/insights', '/contact', '/services']) {
      await page.goto(path);
      await page.locator('[role=group] a[hreflang=he]').first().click();
      await expect(page).toHaveURL(new RegExp(`/he${path}$`));
      expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
      await page.locator('[role=group] a[hreflang=en]').first().click();
      await expect(page).toHaveURL(new RegExp(`localhost:3000${path}$`));
      expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    }
    // the last click chose English; choosing Hebrew once more is remembered for the next visit
    await page.locator('[role=group] a[hreflang=he]').first().click();
    await page.goto('/');
    await expect(page).toHaveURL(/\/he$/);
    await context.close();
  });

  test('the phone menu has the same switch', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: MAIN, extraHTTPHeaders: US, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/about');
    await page.getByRole('button', { name: /menu/i }).first().click();
    await page.locator('[role=group] a[hreflang=he]:visible').first().click();
    await expect(page).toHaveURL(/\/he\/about$/);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
    await context.close();
  });

  test('the links into the campaign pass the language on', async ({ browser }) => {
    const { context, page } = await visitor(browser, IL, MAIN);
    await page.goto('/?lang=en');
    const eligibility = page.locator('a[href*="/eligibility"]').first();
    await expect(eligibility).toHaveAttribute('href', /source=main-site&lang=en/);
    await context.close();
  });
});

test.describe('campaign site', () => {
  test('an entry page: Hebrew from Israel, English elsewhere, and the firm-site link keeps the visitor on the language they read', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: CAMPAIGN, extraHTTPHeaders: IL });
    const html = { accept: 'text/html' };
    for (const [path, to] of [['/', '/he'], ['/eligibility?source=ad', '/he/eligibility?source=ad'], ['/privacy', '/he/privacy'], ['/sign-in', '/he/sign-in']] as const) {
      const res = await il.get(path, { maxRedirects: 0, headers: html });
      expect(res.status(), path).toBe(307);
      expect(res.headers()['location'], path).toContain(to);
    }
    // a link from an English page of the firm's site names the language
    const fromFirm = await il.get('/eligibility?source=main-site&lang=en', { maxRedirects: 0, headers: html });
    expect(fromFirm.status()).toBe(200);
    // the funnel screens after the first step are not redirected by country
    expect((await il.get('/details', { maxRedirects: 0, headers: html })).status()).not.toBe(307);
    const us = await playwright.request.newContext({ baseURL: CAMPAIGN, extraHTTPHeaders: US });
    expect((await us.get('/', { maxRedirects: 0, headers: html })).status()).toBe(200);
    await il.dispose();
    await us.dispose();
  });

  test('the header switch: English <-> Hebrew in both directions, from either default, and it is remembered', async ({ browser }) => {
    const il = await visitor(browser, IL, CAMPAIGN);
    await il.page.goto('/');
    await expect(il.page).toHaveURL(/\/he$/);
    expect(await dirOf(il.page)).toEqual({ lang: 'he', dir: 'rtl' });
    await il.page.locator('[data-lang-switch]').click();
    await expect(il.page).toHaveURL(/localhost:3001\/$/);
    expect(await dirOf(il.page)).toEqual({ lang: 'en', dir: 'ltr' });
    // an Israeli visitor who picked English keeps it
    await il.page.goto('/');
    await expect(il.page).toHaveURL(/localhost:3001\/$/);
    await il.page.locator('[data-lang-switch]').click();
    await expect(il.page).toHaveURL(/\/he$/);
    await il.context.close();

    const abroad = await visitor(browser, US, CAMPAIGN);
    await abroad.page.goto('/');
    expect(await dirOf(abroad.page)).toEqual({ lang: 'en', dir: 'ltr' });
    await abroad.page.locator('[data-lang-switch]').click();
    await expect(abroad.page).toHaveURL(/\/he$/);
    await abroad.page.goto('/');
    await expect(abroad.page).toHaveURL(/\/he$/);
    await abroad.context.close();
  });
});
