import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';
import { campaignIsBilingual, cleanup, funnelIsBilingual, leadByEmail, newEmail } from './support/funnel';
import {
  EN,
  FIRM_URL,
  HE,
  PORTAL_URL,
  answerSixQuestions,
  applyPath,
  followRedirects,
  leaveDetails,
  onFirm,
  onPortal,
  originOf,
  pathAndQuery,
  person,
  urlIs,
} from './support/journey';

/**
 * The language a visitor starts in, and the language switch, on both sites.
 *   - a visitor in Israel (the platform's country header) who opens an English address lands on the Hebrew edition;
 *     anyone else lands on English;
 *   - the switch changes the page to the other language on the same page, in both directions, and remembers the choice:
 *     an Israeli visitor who picks English keeps English, a visitor elsewhere who picks Hebrew gets Hebrew next time;
 *   - search engines are never redirected.
 * The firm's site owns two sets of pages: its own (always bilingual) and the landing page and eligibility funnel under
 * /apply (bilingual only in the NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he setting; english-only.spec.ts covers the default one).
 * The portal (sign-in, portal, CRM) has no public content any more: its entry pages follow the same country rule, and its
 * former public addresses lead to the funnel on the firm's site.
 * The country header is what Vercel sets in production; the tests send it themselves.
 */
const expect = baseExpect.configure({ timeout: 20_000 });
const IL = { 'x-vercel-ip-country': 'IL' };
const US = { 'x-vercel-ip-country': 'US' };
const HTML = { accept: 'text/html' };
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test.afterAll(cleanup);

async function visitor(browser: Browser, headers: Record<string, string>, baseURL: string) {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: headers, viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() };
}
const dirOf = (page: Page) => page.locator('html').evaluate((h: HTMLElement) => ({ lang: h.lang, dir: h.dir }));

test.describe('firm website', () => {
  test('a visitor in Israel lands on Hebrew, a visitor elsewhere on English, and a crawler is left alone', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: IL });
    const res = await il.get('/services/german-citizenship?utm_source=x', { maxRedirects: 0, headers: HTML });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/he/services/german-citizenship?utm_source=x');
    const bot = await il.get('/about', { maxRedirects: 0, headers: { ...HTML, 'user-agent': GOOGLEBOT } });
    expect(bot.status()).toBe(200);
    const us = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: US });
    expect((await us.get('/about', { maxRedirects: 0, headers: HTML })).status()).toBe(200);
    await il.dispose();
    await us.dispose();
  });

  test('from Israel: Hebrew by default; the switch gives English on the same page and the choice sticks; and back', async ({ browser }) => {
    const { context, page } = await visitor(browser, IL, FIRM_URL);
    await page.goto('/services/german-citizenship');
    await expect(page).toHaveURL(/\/he\/services\/german-citizenship$/);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });

    const english = page.locator('[role=group] a[hreflang=en]').first();
    await english.click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/services/german-citizenship'));
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    // the choice is remembered: the home page and another page stay English, although the visitor is in Israel
    await page.goto('/');
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/'));
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
    const { context, page } = await visitor(browser, US, FIRM_URL);
    await page.goto('/about');
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    for (const path of ['/team', '/insights', '/contact', '/services']) {
      await page.goto(path);
      await page.locator('[role=group] a[hreflang=he]').first().click();
      await expect(page).toHaveURL(new RegExp(`/he${path}$`));
      expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
      await page.locator('[role=group] a[hreflang=en]').first().click();
      await expect(page).toHaveURL(urlIs(FIRM_URL, path));
      expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    }
    // the last click chose English; choosing Hebrew once more is remembered for the next visit
    await page.locator('[role=group] a[hreflang=he]').first().click();
    await page.goto('/');
    await expect(page).toHaveURL(/\/he$/);
    await context.close();
  });

  test('the phone menu has the same switch', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: US, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/about');
    await page.getByRole('button', { name: /menu/i }).first().click();
    await page.locator('[role=group] a[hreflang=he]:visible').first().click();
    await expect(page).toHaveURL(/\/he\/about$/);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
    await context.close();
  });

  test('the links from the firm\'s pages into the funnel and the portal keep the language the visitor reads (bilingual setting)', async ({ browser }) => {
    test.skip(!(await funnelIsBilingual()), 'the funnel is English only (default setting): see english-only.spec.ts');
    const { context, page } = await visitor(browser, IL, FIRM_URL);
    // the funnel is part of this site: the home page of each language links to the landing page of the same language
    await page.goto('/?lang=en');
    await expect(page.locator('a[href$="/apply"]').first()).toHaveAttribute('href', '/apply');
    await page.goto('/he');
    await expect(page.locator('a[href$="/apply"]').first()).toHaveAttribute('href', '/he/apply');
    // A service page links to the eligibility check, which is this site's own /apply: an internal link of the page's language
    // (the visitor's choice of language is a cookie of this very site, so no language parameter is needed for the English
    // one), and to the portal's sign-in, which is another site: an absolute link that names the language of the page, so that an
    // Israeli visitor who chose English is not sent to the Hebrew sign-in page on the way
    await page.goto('/services/german-citizenship?lang=en');
    await expect(page.locator('a[href*="/eligibility"]').first()).toHaveAttribute('href', '/apply/eligibility?source=main-site');
    await expect(page.locator('a[href*="/sign-in"]').first()).toHaveAttribute('href', `${originOf(PORTAL_URL)}/sign-in?source=main-site&lang=en`);
    await page.goto('/he/services/german-citizenship');
    const hebrew = page.locator('a[href*="/eligibility"]').first();
    await expect(hebrew).toHaveAttribute('href', '/he/apply/eligibility?source=main-site');
    await expect(hebrew).not.toHaveAttribute('href', /lang=/);
    const hebrewSignIn = page.locator('a[href*="/sign-in"]').first();
    await expect(hebrewSignIn).toHaveAttribute('href', `${originOf(PORTAL_URL)}/he/sign-in?source=main-site`);
    await expect(hebrewSignIn).not.toHaveAttribute('href', /lang=/);
    // the landing page's own sign-in links (header and footer) name the language as well
    await page.goto('/apply?lang=en');
    for (const where of ['header nav', 'footer']) {
      await expect(page.locator(`${where} a[href*="/sign-in"]`).first(), where).toHaveAttribute('href', `${originOf(PORTAL_URL)}/sign-in?source=main-site&lang=en`);
    }
    await page.goto('/he/apply');
    for (const where of ['header nav', 'footer']) {
      await expect(page.locator(`${where} a[href*="/sign-in"]`).first(), where).toHaveAttribute('href', `${originOf(PORTAL_URL)}/he/sign-in?source=main-site`);
    }
    // and following the English link from Israel ends in the English funnel, on the firm's site (no hop through another site)
    await page.goto('/services/german-citizenship?lang=en');
    await page.locator('a[href*="/eligibility"]').first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/eligibility')));
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    await context.close();
  });
});

test.describe('landing page and funnel under /apply on the firm site (bilingual setting)', () => {
  test.beforeAll(async () => {
    test.skip(!(await funnelIsBilingual()), 'the funnel is English only (default setting): see english-only.spec.ts');
  });

  test('an entry page: Hebrew from Israel, English elsewhere, crawlers left alone, an explicit language wins and is remembered', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: IL });
    for (const [path, to] of [['/apply', '/he/apply'], ['/apply/eligibility?source=ad', '/he/apply/eligibility?source=ad'], ['/apply/privacy', '/he/apply/privacy']] as const) {
      const res = await il.get(path, { maxRedirects: 0, headers: HTML });
      expect(res.status(), path).toBe(307);
      expect(res.headers()['location'], path).toContain(to);
    }
    // a Hebrew address is never redirected away, and a crawler sees the page the address names
    expect((await il.get('/he/apply', { maxRedirects: 0, headers: HTML })).status()).toBe(200);
    expect((await il.get('/apply', { maxRedirects: 0, headers: { ...HTML, 'user-agent': GOOGLEBOT } })).status()).toBe(200);
    const us = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: US });
    expect((await us.get('/apply', { maxRedirects: 0, headers: HTML })).status()).toBe(200);
    // ?lang=he from abroad is a choice too
    const hebrew = await us.get('/apply?lang=he', { maxRedirects: 0, headers: HTML });
    expect(hebrew.status()).toBe(307);
    expect(hebrew.headers()['location']).toContain('/he/apply');
    await us.dispose();

    // a link from an English page of the firm's site names the language: the Israeli visitor stays on English, and every screen
    // of the funnel after that (the cookie of the choice) as well
    const fromFirm = await il.get('/apply/eligibility?source=main-site&lang=en', { maxRedirects: 0, headers: HTML });
    expect(fromFirm.status()).toBe(200);
    expect(fromFirm.headersArray().some((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith('dpl_lang=en'))).toBe(true);
    for (const screen of ['/apply', '/apply/eligibility', '/apply/details', '/apply/booking', '/apply/offer', '/apply/privacy']) {
      expect((await il.get(screen, { maxRedirects: 0, headers: HTML })).status(), screen).toBe(200);
    }
    await il.dispose();
  });

  test('the switch on the landing page: English <-> Hebrew in both directions, from either default, and it is remembered', async ({ browser }) => {
    const israeli = await visitor(browser, IL, FIRM_URL);
    await israeli.page.goto('/apply');
    await expect(israeli.page).toHaveURL(/\/he\/apply$/);
    expect(await dirOf(israeli.page)).toEqual({ lang: 'he', dir: 'rtl' });
    await israeli.page.locator('[data-lang-switch]').click();
    await expect(israeli.page).toHaveURL(urlIs(FIRM_URL, '/apply'));
    expect(await dirOf(israeli.page)).toEqual({ lang: 'en', dir: 'ltr' });
    // an Israeli visitor who picked English keeps it
    await israeli.page.goto('/apply');
    await expect(israeli.page).toHaveURL(urlIs(FIRM_URL, '/apply'));
    await israeli.page.locator('[data-lang-switch]').click();
    await expect(israeli.page).toHaveURL(/\/he\/apply$/);
    await israeli.context.close();

    const abroad = await visitor(browser, US, FIRM_URL);
    await abroad.page.goto('/apply');
    expect(await dirOf(abroad.page)).toEqual({ lang: 'en', dir: 'ltr' });
    await abroad.page.locator('[data-lang-switch]').click();
    await expect(abroad.page).toHaveURL(/\/he\/apply$/);
    expect(await dirOf(abroad.page)).toEqual({ lang: 'he', dir: 'rtl' });
    await abroad.page.goto('/apply');
    await expect(abroad.page).toHaveURL(/\/he\/apply$/);
    await abroad.context.close();
  });

  test('a visitor from Israel goes through the funnel in Hebrew and the lead is a Hebrew one', async ({ browser }) => {
    test.setTimeout(120_000);
    const email = newEmail('lang-il');
    const v = await person(browser, { locale: 'he', tz: 'Asia/Jerusalem', headers: IL });
    const page = v.page;
    await page.goto(onFirm('/apply'));
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/he/apply'));
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
    await page.locator(`a[href$="${applyPath(HE, '/eligibility')}"]`).first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(HE, '/eligibility')));
    await answerSixQuestions(page, FIRM_URL, HE);
    expect(await dirOf(page)).toEqual({ lang: 'he', dir: 'rtl' });
    await leaveDetails(page, FIRM_URL, HE, { name: HE.name, email });
    expect(await leadByEmail(email)).toMatchObject({ locale: 'he', stage: 'lead' });
    expect(v.problems).toEqual([]);
    await v.ctx.close();
  });

  test('a visitor from Israel who picks English on the landing page keeps English through the funnel, also after a reload', async ({ browser }) => {
    test.setTimeout(120_000);
    const email = newEmail('lang-il-en');
    const v = await person(browser, { locale: 'en', tz: 'Asia/Jerusalem', headers: IL });
    const page = v.page;
    await page.goto(onFirm('/apply'));
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/he/apply'));
    await page.locator('[data-lang-switch]').click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/apply'));
    await page.locator(`a[href$="${applyPath(EN, '/eligibility')}"]`).first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/eligibility')));
    await answerSixQuestions(page, FIRM_URL, EN);
    // a page load of a funnel screen (not a client-side step) is not sent to Hebrew by the country
    await page.reload();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/details')));
    expect(await dirOf(page)).toEqual({ lang: 'en', dir: 'ltr' });
    await leaveDetails(page, FIRM_URL, EN, { name: EN.name, email });
    expect(await leadByEmail(email)).toMatchObject({ locale: 'en', stage: 'lead' });
    expect(v.problems).toEqual([]);
    await v.ctx.close();
  });
});

test.describe('portal (bilingual setting)', () => {
  test.beforeAll(async () => {
    test.skip(!(await campaignIsBilingual()), 'the portal is English only (default setting): see english-only.spec.ts');
  });

  test('the entry pages: Hebrew from Israel, English elsewhere; the portal pages themselves are not redirected by country', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: PORTAL_URL, extraHTTPHeaders: IL });
    for (const [path, to] of [['/sign-in', '/he/sign-in'], ['/sign-in?next=%2Fportal', '/he/sign-in?next=%2Fportal'], ['/', '/he']] as const) {
      const res = await il.get(path, { maxRedirects: 0, headers: HTML });
      expect(res.status(), path).toBe(307);
      expect(res.headers()['location'], path).toContain(to);
    }
    // the bare address of the portal is its sign-in: the Hebrew one from Israel
    const chain = await followRedirects(il, onPortal('/'));
    expect(pathAndQuery(chain.at(-1)!.url)).toBe('/he/sign-in');
    expect(chain.at(-1)!.status).toBe(200);
    // a link that names the language wins over the country
    expect((await il.get('/sign-in?lang=en', { maxRedirects: 0, headers: HTML })).status()).toBe(200);
    // a crawler sees what the address names
    expect((await il.get('/sign-in', { maxRedirects: 0, headers: { ...HTML, 'user-agent': GOOGLEBOT } })).status()).toBe(200);
    // pages inside the portal keep the language of the address: a signed-out visitor is asked to sign in, in English
    const portal = await il.get('/portal', { maxRedirects: 0, headers: HTML });
    expect(portal.status()).toBe(307);
    expect(pathAndQuery(portal.headers()['location']!)).toBe('/sign-in?next=%2Fportal');

    const us = await playwright.request.newContext({ baseURL: PORTAL_URL, extraHTTPHeaders: US });
    const chainUs = await followRedirects(us, onPortal('/'));
    expect(pathAndQuery(chainUs.at(-1)!.url)).toBe('/sign-in');
    expect(chainUs.at(-1)!.status).toBe(200);
    expect((await us.get('/sign-in', { maxRedirects: 0, headers: HTML })).status()).toBe(200);
    await il.dispose();
    await us.dispose();
  });

  test('the sign-in page in Hebrew is right-to-left and does not bounce an Israeli visitor away from the English one they asked for', async ({ browser }) => {
    const il = await visitor(browser, IL, PORTAL_URL);
    await il.page.goto('/sign-in');
    await expect(il.page).toHaveURL(urlIs(PORTAL_URL, '/he/sign-in'));
    expect(await dirOf(il.page)).toEqual({ lang: 'he', dir: 'rtl' });
    // the explicit choice of English (a link with ?lang=en) is kept, and remembered for the next visit
    await il.page.goto('/sign-in?lang=en');
    await expect(il.page).toHaveURL(/\/sign-in\?lang=en$/);
    expect(await dirOf(il.page)).toEqual({ lang: 'en', dir: 'ltr' });
    await il.page.goto('/sign-in');
    await expect(il.page).toHaveURL(urlIs(PORTAL_URL, '/sign-in'));
    await il.context.close();
  });
});

/**
 * The portal used to carry the landing page and the eligibility funnel; ads, emails and bookmarks still point at those
 * addresses. They forward to the firm's site (NEXT_PUBLIC_MAIN_SITE_URL of the portal's build = the firm's address), keeping
 * the language prefix and the whole query (source, utm_*), whatever the country: the country rule then applies on the firm's side.
 */
test.describe('the portal\'s former public addresses', () => {
  const MOVED = [
    ['/eligibility?source=ad&utm_source=x', '/apply/eligibility?source=ad&utm_source=x'],
    ['/booking', '/apply/booking'],
    ['/offer', '/apply/offer'],
    ['/details', '/apply/details'],
    ['/privacy', '/apply/privacy'],
    ['/ger-aus', '/apply'],
    ['/?entry=eligibility&source=newsletter', '/apply?source=newsletter'],
    ['/he/eligibility?source=ad', '/he/apply/eligibility?source=ad'],
    ['/he/privacy', '/he/apply/privacy'],
    ['/he/ger-aus', '/he/apply'],
  ] as const;

  test('forward to the same page of the funnel on the firm\'s site, query kept', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: PORTAL_URL, extraHTTPHeaders: US });
    for (const [from, to] of MOVED) {
      const res = await api.get(from, { maxRedirects: 0, headers: HTML });
      expect([301, 308], from).toContain(res.status());
      const target = new URL(res.headers()['location']!, PORTAL_URL);
      expect(target.origin, `${from} leaves the portal's site`).toBe(originOf(FIRM_URL));
      expect(`${target.pathname}${target.search}`, from).toBe(to);
    }
    await api.dispose();
  });

  test('an old English ad link ends in the Hebrew funnel for a visitor in Israel and in the English one elsewhere (bilingual setting)', async ({ playwright }) => {
    test.skip(!(await funnelIsBilingual()), 'the funnel is English only (default setting): see english-only.spec.ts');
    const il = await playwright.request.newContext({ extraHTTPHeaders: IL });
    const chainIl = await followRedirects(il, onPortal('/eligibility?source=ad'));
    const lastIl = chainIl.at(-1)!;
    expect(lastIl.status).toBe(200);
    expect(originOf(lastIl.url)).toBe(originOf(FIRM_URL));
    expect(pathAndQuery(lastIl.url)).toBe('/he/apply/eligibility?source=ad');
    const us = await playwright.request.newContext({ extraHTTPHeaders: US });
    const chainUs = await followRedirects(us, onPortal('/eligibility?source=ad'));
    expect(pathAndQuery(chainUs.at(-1)!.url)).toBe('/apply/eligibility?source=ad');
    expect(chainUs.at(-1)!.status).toBe(200);
    await il.dispose();
    await us.dispose();
  });
});
