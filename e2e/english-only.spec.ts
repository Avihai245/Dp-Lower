import { expect as baseExpect, test } from '@playwright/test';
import { campaignIsBilingual, cleanup, funnelIsBilingual, leadByEmail, newEmail } from './support/funnel';
import {
  EN,
  FIRM_URL,
  PORTAL_URL,
  answerSixQuestions,
  applyPath,
  followRedirects,
  leaveDetails,
  onFirm,
  originOf,
  pathAndQuery,
  person,
  urlIs,
} from './support/journey';

/**
 * The campaign's public pages are English only (NEXT_PUBLIC_CAMPAIGN_LOCALES unset, the default). The Hebrew edition is
 * built but switched off. Since the landing page and the eligibility funnel moved to the firm's site, that means:
 *   - on the firm's site: /he/apply... goes to the English /apply... (query kept), a visitor in Israel stays on English there,
 *     there is no language switch on the landing page, no hreflang, no Hebrew line in the sitemap, and the firm's own pages stay
 *     bilingual, with their links into the funnel and the portal ending on English pages;
 *   - on the portal: every address under /he (the staff area aside) goes to the English page, a visitor in Israel stays on
 *     English, and the former public addresses (/eligibility, /he/eligibility, ...) end on the English funnel of the firm's site.
 * These tests run against the default build and skip themselves on a bilingual one (language.spec.ts covers that).
 */
const expect = baseExpect.configure({ timeout: 20_000 });
const IL = { 'x-vercel-ip-country': 'IL' };
const US = { 'x-vercel-ip-country': 'US' };
const HTML = { accept: 'text/html' };

test.afterAll(cleanup);

test.describe('portal', () => {
  test.beforeAll(async () => {
    test.skip(await campaignIsBilingual(), 'the portal is bilingual in this build');
  });

  test('every address under /he goes to its English page, query kept; the staff area keeps Hebrew', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: PORTAL_URL, extraHTTPHeaders: IL });
    for (const [from, to] of [['/he', '/'], ['/he/sign-in', '/sign-in'], ['/he/sign-in?next=%2Fportal', '/sign-in?next=%2Fportal'], ['/he/portal', '/portal']] as const) {
      const res = await api.get(from, { maxRedirects: 0, headers: HTML });
      expect(res.status(), from).toBe(307);
      expect(pathAndQuery(new URL(res.headers()['location']!, PORTAL_URL).toString()), from).toBe(to);
    }
    // the staff area is not one of the public pages: signed out it asks to sign in, in Hebrew
    const admin = await api.get('/he/admin', { maxRedirects: 0, headers: HTML });
    expect(admin.headers()['location']).toContain('/he/sign-in');
    await api.dispose();
  });

  test('a visitor in Israel stays on English: the bare address is the English sign-in, no switch, no hreflang, nothing Hebrew in robots', async ({ browser, playwright }) => {
    const context = await browser.newContext({ baseURL: PORTAL_URL, extraHTTPHeaders: IL, locale: 'he-IL' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(urlIs(PORTAL_URL, '/sign-in'));
    expect(await page.locator('html').evaluate((h: HTMLElement) => ({ lang: h.lang, dir: h.dir }))).toEqual({ lang: 'en', dir: 'ltr' });
    await expect(page.locator('[data-lang-switch]')).toHaveCount(0);
    await expect(page.locator('link[rel=alternate][hreflang]')).toHaveCount(0);
    await context.close();

    const api = await playwright.request.newContext({ baseURL: PORTAL_URL });
    expect(await (await api.get('/robots.txt')).text()).not.toContain('/he/');
    const sitemap = await (await api.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/he');
    expect(sitemap).not.toContain('hreflang');
    for (const name of ['llms.txt', 'llms-full.txt']) {
      const res = await api.get(`/he/${name}`, { maxRedirects: 0 });
      expect(res.status(), name).toBe(308);
      expect(res.headers()['location']).toBe(`/${name}`);
      expect((await api.get(`/${name}`)).status()).toBe(200);
    }
    await api.dispose();
  });

  test('the former public addresses end on the English funnel of the firm\'s site, also the Hebrew ones and also from Israel', async ({ playwright }) => {
    test.skip(await funnelIsBilingual(), 'the firm\'s funnel is bilingual in this build');
    const api = await playwright.request.newContext({ extraHTTPHeaders: IL });
    for (const [from, to] of [
      ['/eligibility?source=ad&utm_source=x', '/apply/eligibility?source=ad&utm_source=x'],
      ['/he/eligibility?source=ad', '/apply/eligibility?source=ad'],
      ['/he/eligibility?source=ad&lang=he', '/apply/eligibility?source=ad'],
      ['/privacy', '/apply/privacy'],
      ['/he/privacy', '/apply/privacy'],
      ['/ger-aus', '/apply'],
      ['/he/ger-aus', '/apply'],
      ['/?entry=eligibility&source=newsletter', '/apply?source=newsletter'],
    ] as const) {
      const hops = await followRedirects(api, `${PORTAL_URL}${from}`);
      const last = hops.at(-1)!;
      expect(last.status, from).toBe(200);
      expect(originOf(last.url), `${from} ends on the firm's site`).toBe(originOf(FIRM_URL));
      expect(pathAndQuery(last.url), from).toBe(to);
    }
    await api.dispose();
  });
});

test.describe('landing page and funnel on the firm\'s site', () => {
  test.beforeAll(async () => {
    test.skip(await funnelIsBilingual(), 'the firm\'s funnel is bilingual in this build');
  });

  test('every Hebrew address of the funnel goes to its English page, query kept; a visitor in Israel is not sent to Hebrew', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: IL });
    for (const [from, to] of [
      ['/he/apply', '/apply'],
      ['/he/apply/eligibility?source=ad', '/apply/eligibility?source=ad'],
      ['/he/apply/eligibility?source=ad&lang=he', '/apply/eligibility?source=ad'],
      ['/he/apply/details', '/apply/details'],
      ['/he/apply/booking', '/apply/booking'],
      ['/he/apply/offer', '/apply/offer'],
      ['/he/apply/privacy', '/apply/privacy'],
    ] as const) {
      const res = await api.get(from, { maxRedirects: 0, headers: HTML });
      expect(res.status(), from).toBe(307);
      expect(pathAndQuery(new URL(res.headers()['location']!, FIRM_URL).toString()), from).toBe(to);
    }
    // the English addresses answer, from Israel and elsewhere, also when the link asks for Hebrew
    const us = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: US });
    for (const client of [api, us]) {
      for (const screen of ['/apply', '/apply/eligibility', '/apply/details', '/apply/privacy', '/apply?lang=he']) {
        expect((await client.get(screen, { maxRedirects: 0, headers: HTML })).status(), screen).toBe(200);
      }
    }
    await us.dispose();
    await api.dispose();
  });

  test('the landing page: English even from Israel, no language switch, no hreflang, nothing Hebrew about it in the sitemap', async ({ browser, playwright }) => {
    const context = await browser.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: IL, locale: 'he-IL' });
    const page = await context.newPage();
    await page.goto('/apply');
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/apply'));
    expect(await page.locator('html').evaluate((h: HTMLElement) => ({ lang: h.lang, dir: h.dir }))).toEqual({ lang: 'en', dir: 'ltr' });
    await expect(page.locator('[data-lang-switch]')).toHaveCount(0);
    await expect(page.locator('link[rel=alternate][hreflang]')).toHaveCount(0);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `${FIRM_URL}/apply`);
    // the eligibility button stays on the English funnel
    await page.locator('a[href$="/apply/eligibility"]').first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/apply/eligibility'));
    await context.close();

    const api = await playwright.request.newContext({ baseURL: FIRM_URL });
    const sitemap = await (await api.get('/sitemap.xml')).text();
    const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]!);
    const entryOf = (loc: string) => entries.find((e) => e.includes(`<loc>${loc}</loc>`));
    for (const path of ['/apply', '/apply/privacy']) {
      const english = entryOf(`${FIRM_URL}${path}`);
      expect(english, `${path} is in the sitemap`).toBeTruthy();
      expect(english, `${path} has no Hebrew alternate`).not.toContain('hreflang');
      expect(entryOf(`${FIRM_URL}/he${path}`), `/he${path} is not in the sitemap`).toBeUndefined();
    }
    // the firm's own pages are untouched: both languages, with their alternates
    expect(entryOf(`${FIRM_URL}/he/about`)).toContain('hreflang="en"');
    expect(entryOf(`${FIRM_URL}/about`)).toContain('hreflang="he"');
    // the llms files name the funnel, in English, and the firm's Hebrew one is still there
    expect(await (await api.get('/llms.txt')).text()).toContain(`${FIRM_URL}/apply`);
    expect((await api.get('/he/llms.txt')).status()).toBe(200);
    await api.dispose();
  });

  test('the firm\'s own pages stay bilingual (Hebrew start from Israel), and their links lead to English pages: the funnel and the portal', async ({ playwright }) => {
    const il = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: IL });
    const about = await il.get('/about', { maxRedirects: 0, headers: HTML });
    expect(about.status()).toBe(307);
    expect(about.headers()['location']).toContain('/he/about');
    await il.dispose();

    const api = await playwright.request.newContext({ baseURL: FIRM_URL, extraHTTPHeaders: US });
    const funnelLinks = new Set<string>();
    const portalLinks = new Set<string>();
    for (const path of ['/', '/he', '/contact', '/he/contact', '/services/german-citizenship', '/he/services/german-citizenship']) {
      const body = await (await api.get(path, { headers: HTML })).text();
      for (const m of body.matchAll(/href="([^"]+)"/g)) {
        const href = new URL(m[1]!.replace(/&amp;/g, '&'), FIRM_URL);
        if (href.origin === originOf(FIRM_URL) && /^(\/he)?\/apply(\/|$)/.test(href.pathname)) funnelLinks.add(`${path} -> ${href}`);
        if (href.origin === originOf(PORTAL_URL) && /\/(eligibility|sign-in)$/.test(href.pathname)) portalLinks.add(`${path} -> ${href}`);
      }
    }
    expect(funnelLinks.size + portalLinks.size, 'the firm\'s pages link into the funnel and the portal').toBeGreaterThan(0);
    // the links into the portal's pages name no Hebrew edition and no language
    for (const link of portalLinks) {
      const target = link.split(' -> ')[1]!;
      expect(target, link).not.toContain('/he/');
      expect(target, link).not.toContain('lang=');
    }
    // and every one of the links, from either language of the firm's site, ends on an English page that answers
    for (const link of [...funnelLinks, ...portalLinks]) {
      const [, target] = link.split(' -> ');
      const hops = await followRedirects(api, target!);
      const last = hops.at(-1)!;
      expect(last.status, link).toBe(200);
      expect(pathAndQuery(last.url), link).not.toMatch(/^\/he(\/|$)/);
      expect(pathAndQuery(last.url), link).not.toContain('lang=');
    }
    await api.dispose();
  });

  test('a visitor in Israel on the firm\'s Hebrew home page opens the eligibility check and goes through it in English; the lead is an English one', async ({ browser }) => {
    test.setTimeout(120_000);
    const email = newEmail('eo-il');
    const v = await person(browser, { locale: 'he', tz: 'Asia/Jerusalem', headers: IL });
    const page = v.page;
    await page.goto(onFirm('/he'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('a[href$="/apply"]').first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, '/apply'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator(`a[href$="${applyPath(EN, '/eligibility')}"]`).first().click();
    await expect(page).toHaveURL(urlIs(FIRM_URL, applyPath(EN, '/eligibility')));
    await answerSixQuestions(page, FIRM_URL, EN);
    await leaveDetails(page, FIRM_URL, EN, { name: EN.name, email });
    expect(await leadByEmail(email)).toMatchObject({ locale: 'en', stage: 'lead' });
    expect(v.problems).toEqual([]);
    await v.ctx.close();
  });
});
