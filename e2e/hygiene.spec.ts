import { expect, test, type Page } from '@playwright/test';

/**
 * Cross-cutting checks on the built apps, in both languages: security headers, a Content-Security-Policy that nothing
 * the pages do violates, no script errors or hydration failures, the right lang/dir, and the SEO tags that every
 * indexable page needs (and that the funnel pages must not have). Run against `next start` servers:
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/hygiene.spec.ts
 *
 * Two sites: MAIN is the firm's website AND, under /apply, the landing page and the eligibility funnel; CAMPAIGN is the
 * client portal (sign-in and the pages around it; its bare address is the sign-in, its old landing paths redirect to
 * MAIN's /apply). The Hebrew edition of /apply (/he/apply) needs NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he on MAIN.
 */
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';
const APPLY = '/apply';

/** Is the Hebrew edition of the funnel (/he/apply) switched on? Without it that address redirects to /apply. */
let hebrewFunnel = true;
/** The same for the client portal (/he/sign-in redirects to /sign-in without it). */
let hebrewCampaign = true;
test.beforeAll(async () => {
  const res = await fetch(`${MAIN}/he${APPLY}`, { redirect: 'manual', headers: { accept: 'text/html' } });
  hebrewFunnel = res.status !== 307 && res.status !== 308;
  const portal = await fetch(`${CAMPAIGN}/he/sign-in`, { redirect: 'manual', headers: { accept: 'text/html' } });
  hebrewCampaign = portal.status !== 307 && portal.status !== 308;
});

interface Watch {
  problems: string[];
  violations: () => Promise<string[]>;
}

/** Collects what a page does wrong while it loads, is scrolled and is used: script errors, CSP violations, failed own requests. */
async function watch(page: Page, origin: string): Promise<Watch> {
  const problems: string[] = [];
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI}`));
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    // the sandbox has no internet: failed third-party loads (fonts CDN, YouTube, Turnstile) are not the page's fault
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(text)) problems.push(`console.error: ${text}`);
    if (/Content Security Policy|Minified React error|Hydration|did not match/i.test(text)) problems.push(`console: ${text}`);
  });
  page.on('requestfailed', (r) => {
    // only the app's own files matter, and an aborted navigation (a redirect, a closing page) is not a failure
    if (r.url().startsWith(origin) && !/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    // the image optimizer cannot fetch remote images (YouTube thumbnails) where there is no internet
    if (/\/_next\/image\?url=https?%3A/.test(r.url())) return;
    if (r.url().startsWith(origin) && r.status() >= 500) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return { problems, violations: () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp) };
}

/** Scrolls the whole page in steps so lazy content, reveal animations and sticky bars run. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

const strip = (u: string | null) => (u ?? '').replace(/\/+$/, '');
const meta = (page: Page, selector: string, attr = 'content') => page.locator(selector).first().getAttribute(attr);

test.describe('fonts', () => {
  for (const [name, origin, path] of [
    ['campaign', CAMPAIGN, '/sign-in'],
    ['campaign', CAMPAIGN, '/link-expired'],
    ['main', MAIN, '/'],
    ['main', MAIN, '/team'],
    ['main', MAIN, APPLY],
    ['main', MAIN, `${APPLY}/eligibility`],
  ] as const) {
    test(`${name} ${path}: the Hebrew page asks for its four font files with the page, the English one for none`, async ({ request }) => {
      test.skip(path.startsWith(APPLY) && !hebrewFunnel, 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      test.skip(origin === CAMPAIGN && !hebrewCampaign, 'the Hebrew edition of the portal is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      // a page rendered ahead of time carries the hints in its HTML, one rendered per request in a `Link` response header
      const preloaded = async (url: string) => {
        const res = await request.get(url);
        const inHtml = [...(await res.text()).matchAll(/<link rel="preload" href="([^"]+)" as="font"[^>]*>/g)].map((m) => m[1]!);
        const inHeader = [...(res.headers()['link'] ?? '').matchAll(/<([^>]+\.woff2)>; rel=preload; as="font"/g)].map((m) => m[1]!);
        return [...new Set([...inHtml, ...inHeader])];
      };
      expect(await preloaded(`${origin}${path}`)).toEqual([]);

      const hebrew = await preloaded(`${origin}/he${path === '/' ? '' : path}`);
      expect(hebrew.map((h) => h.replace(/^.*\/|\.[0-9a-f]{8}\.woff2$/g, '')).sort()).toEqual([
        'assistant-hebrew-wght-normal',
        'assistant-latin-wght-normal',
        'frank-ruhl-libre-hebrew-wght-normal',
        'frank-ruhl-libre-latin-wght-normal',
      ]);
      for (const href of hebrew) {
        const res = await request.get(`${origin}${href}`);
        expect(res.status(), href).toBe(200);
        expect(res.headers()['content-type']).toContain('font/woff2');
        expect(res.headers()['cache-control']).toContain('immutable');
      }
    });
  }

  test('English pages do not download the Hebrew fonts (the language switch is not prefetched) and log no unused-preload warning', async ({ page }) => {
    // the one exception: the header of the landing page and the funnel (the firm's /apply) writes the other language's
    // name, "עברית", in the Hebrew-capable family (7 KB); the portal's sign-in has no language switch and loads none
    for (const url of [`${CAMPAIGN}/`, `${CAMPAIGN}/sign-in`, `${MAIN}/`, `${MAIN}/team`, `${MAIN}${APPLY}`, `${MAIN}${APPLY}/eligibility`]) {
      const fonts: string[] = [];
      const warnings: string[] = [];
      page.on('response', (r) => {
        if (r.request().resourceType() === 'font') fonts.push(r.url());
      });
      page.on('console', (m) => {
        if (/preloaded using link preload but not used/.test(m.text())) warnings.push(m.text());
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const hebrew = fonts.filter((f) => /hebrew|frank-ruhl|assistant/.test(f)).map((f) => f.replace(/^.*\//, '').replace(/\.[0-9a-f]{8}\.woff2$/, ''));
      const switchLabelOnly = url.startsWith(`${MAIN}${APPLY}`) && hebrewFunnel;
      expect(hebrew, url).toEqual(switchLabelOnly ? ['assistant-hebrew-wght-normal'] : []);
      expect(warnings, url).toEqual([]);
      page.removeAllListeners('response');
      page.removeAllListeners('console');
    }
  });

  test('a Hebrew page does not jump when its fonts arrive (a 412 px phone on a slow connection)', async ({ browser }) => {
    test.skip(!hebrewFunnel, 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
    for (const url of [`${CAMPAIGN}/he/sign-in`, `${MAIN}/he`, `${MAIN}/he${APPLY}`]) {
      const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(3500);
      // the headline numbers of Lighthouse: 0.1 is "good"; before the fonts were preloaded this page measured 0.21
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), url).toBeLessThan(0.05);
      await context.close();
    }
  });
});

test.describe('without JavaScript', () => {
  // the landing page lives on the firm's site now (the campaign's own address is the portal's sign-in)
  for (const [path, figures] of [[APPLY, ['1,200+', '15+', '94%', '30+']], [`/he${APPLY}`, ['1,200+', '15+', '94%', '30+']]] as const) {
    test(`main ${path}: the figures show their real values, not 0 (the count-up needs scripts)`, async ({ browser }) => {
      // The figures strip draws "0+" / "0%" and counts up with scripts; the real values are in a visually hidden span
      // (.dpl-sr-only). Without scripts the <noscript><style> of the /apply layout hides the "0+" and shows the real value, so a
      // visitor without JavaScript (and a crawler that does not run it) is not told "0+ 0+ 0% 0+".
      test.skip(path.startsWith('/he') && !hebrewFunnel, 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${MAIN}${path}`);
      const strip = page.locator('[data-count]');
      await strip.scrollIntoViewIfNeeded();
      for (const figure of figures) await expect(strip.locator('.dpl-sr-only', { hasText: new RegExp(`^${figure.replace(/[+]/g, '\\+')}$`) })).toBeVisible();
      // and nothing in it still reads "0+" or "0%"
      const text = (await strip.innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(/(^|\s)0[+%]/);
      await context.close();
    });

    test(`main ${path}: the page is complete without scripts: headline, the way into the quiz, the figures strip and the questions`, async ({ browser }) => {
      test.skip(path.startsWith('/he') && !hebrewFunnel, 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const res = await page.goto(`${MAIN}${path}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const prefix = path.startsWith('/he') ? '/he' : '';
      await expect(page.locator(`a[href="${prefix}${APPLY}/eligibility"]`).first()).toBeVisible();
      // the figures and the answers are in the page itself, not drawn by scripts
      await expect(page.locator('[data-count]')).toHaveCount(1);
      expect(await page.locator('[data-count] .dpl-sr-only').allTextContents()).toEqual(figures);
      expect(await page.locator('details, [aria-expanded]').count()).toBeGreaterThan(0);
      await context.close();
    });
  }
});

test.describe('security headers', () => {
  /** The hardening headers and the strict CSP of one response. */
  const expectHardened = (h: Record<string, string>, what: string) => {
    expect(h['x-content-type-options'], what).toBe('nosniff');
    expect(h['x-frame-options'], what).toBe('SAMEORIGIN');
    expect(h['referrer-policy'], what).toBe('strict-origin-when-cross-origin');
    expect(h['strict-transport-security'], what).toContain('max-age=');
    expect(h['permissions-policy'], what).toContain('camera=()');
    const csp = h['content-security-policy'] ?? '';
    expect(csp, what).toContain("default-src 'self'");
    expect(csp, what).toContain("object-src 'none'");
    expect(csp, what).toContain("base-uri 'self'");
    expect(csp, what).toContain("frame-ancestors 'self'");
    // nothing may be framed or scripted from anywhere but the services the pages really use
    for (const host of csp.match(/https?:\/\/[^\s;]+/g) ?? []) {
      expect(host, `${what}: unexpected host in the CSP: ${host}`).toMatch(/challenges\.cloudflare\.com|youtube(-nocookie)?\.com|i\.ytimg\.com|127\.0\.0\.1|localhost|\.supabase\.co/);
    }
    expect(csp, what).not.toContain("'unsafe-eval'");
  };

  for (const [name, origin, paths] of [
    ['campaign', CAMPAIGN, ['/sign-in', '/he/sign-in']],
    ['main', MAIN, ['/', '/he', APPLY, `/he${APPLY}`]],
  ] as const) {
    test(`${name}: every response carries the hardening headers and a strict CSP`, async ({ request }) => {
      for (const path of paths) {
        if (path.startsWith('/he/apply') && !hebrewFunnel) continue;
        const res = await request.get(origin + path);
        expect(res.status(), path).toBe(200);
        expectHardened(res.headers(), path);
      }
    });
  }

  test('campaign: its bare address (a redirect to the sign-in) carries them too', async ({ request }) => {
    // (the permanent redirects of the old landing addresses come from next.config redirects(), which Next.js answers
    // before it adds the configured headers: they have no body and lead to the firm's site, which sets its own)
    for (const path of ['/', '/he']) {
      const res = await request.get(CAMPAIGN + path, { maxRedirects: 0 });
      expect([307, 308], path).toContain(res.status());
      expectHardened(res.headers(), path);
    }
  });
});

interface PageCase {
  path: string;
  lang: 'en' | 'he';
  dir: 'ltr' | 'rtl';
  indexable: boolean;
  /** false: this page has no Hebrew edition in this build (the /apply funnel with NEXT_PUBLIC_CAMPAIGN_LOCALES=en) */
  alternates?: boolean;
}

/** The checks every page gets: a clean console, no CSP violation, the right lang/dir, the SEO tags (or noindex). */
async function checkPage(page: Page, origin: string, p: PageCase) {
  const w = await watch(page, origin);
  await page.goto(origin + p.path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await scrollThrough(page);

  expect(await page.locator('html').getAttribute('lang')).toBe(p.lang);
  expect(await page.locator('html').getAttribute('dir')).toBe(p.dir);
  expect(await page.title()).not.toBe('');
  const robots = await meta(page, 'meta[name=robots]');
  if (p.indexable) {
    expect(robots ?? '').not.toContain('noindex');
    // the canonical is built from the configured site URL, which for these servers is their own origin
    expect(strip(await meta(page, 'link[rel=canonical]', 'href'))).toBe(strip(origin + p.path));
    const hreflangs = await page.locator('link[rel=alternate][hreflang]').evaluateAll((els) => els.map((e) => e.getAttribute('hreflang')));
    if (p.alternates === false) expect(hreflangs).not.toContain('he');
    else expect(hreflangs).toEqual(expect.arrayContaining(['en', 'he']));
  } else {
    expect(robots).toContain('noindex');
  }
  expect(await w.violations(), 'CSP violations').toEqual([]);
  expect(w.problems).toEqual([]);
}

// the client portal's own public pages (the sign-in and the pages around it: none of them is indexable)
const campaignPages: PageCase[] = [
  { path: '/sign-in', lang: 'en', dir: 'ltr', indexable: false },
  { path: '/he/sign-in', lang: 'he', dir: 'rtl', indexable: false },
  { path: '/link-expired', lang: 'en', dir: 'ltr', indexable: false },
  { path: '/he/link-expired', lang: 'he', dir: 'rtl', indexable: false },
];

test.describe('campaign pages', () => {
  for (const p of campaignPages) {
    test(`${p.path}: clean console, no CSP violation, lang/dir, noindex`, async ({ page }) => {
      test.skip(p.lang === 'he' && !hebrewCampaign, 'the Hebrew edition of the portal is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      await checkPage(page, CAMPAIGN, p);
    });
  }

  test('its bare address is the sign-in page, in either language', async ({ page }) => {
    // (without the Hebrew edition /he is the English sign-in too)
    for (const [from, to] of [['/', '/sign-in'], ['/he', hebrewCampaign ? '/he/sign-in' : '/sign-in']] as const) {
      await page.goto(CAMPAIGN + from);
      expect(new URL(page.url()).pathname, from).toBe(to);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});

// the landing page and the eligibility funnel, which live on the firm's site under /apply
const funnelPages: PageCase[] = [
  { path: APPLY, lang: 'en', dir: 'ltr', indexable: true },
  { path: `/he${APPLY}`, lang: 'he', dir: 'rtl', indexable: true },
  { path: `${APPLY}/privacy`, lang: 'en', dir: 'ltr', indexable: true },
  { path: `/he${APPLY}/privacy`, lang: 'he', dir: 'rtl', indexable: true },
  { path: `${APPLY}/eligibility`, lang: 'en', dir: 'ltr', indexable: false },
  { path: `/he${APPLY}/eligibility`, lang: 'he', dir: 'rtl', indexable: false },
];

test.describe('landing page and funnel (the firm site, /apply)', () => {
  for (const p of funnelPages) {
    test(`${p.path}: clean console, no CSP violation, lang/dir, ${p.indexable ? 'indexable with alternates' : 'noindex'}`, async ({ page }) => {
      test.skip(p.lang === 'he' && !hebrewFunnel, 'the Hebrew edition of /apply is switched off (NEXT_PUBLIC_CAMPAIGN_LOCALES)');
      await checkPage(page, MAIN, { ...p, alternates: p.path.startsWith(APPLY) && !hebrewFunnel ? false : undefined });
    });
  }

  test('the landing page: opening the chat, the advisor and the FAQ breaks nothing', async ({ page }) => {
    const w = await watch(page, MAIN);
    await page.goto(MAIN + APPLY);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await scrollThrough(page);
    // every control that opens something, opened and closed with the keyboard
    const faq = page.locator('details > summary, [aria-expanded]').first();
    if (await faq.count()) await faq.click();
    await page.getByRole('button', { name: /AI Advisor|Speak with/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await w.violations(), 'CSP violations').toEqual([]);
    expect(w.problems).toEqual([]);
  });
});

/** One page of every kind; e2e/seo.spec.ts walks the whole sitemap. */
const mainPages = [
  '/', '/about', '/services', '/services/german-citizenship', '/team', '/team/michael-decker', '/testimonials', '/insights', '/media', '/contact',
  '/privacy', '/terms', '/accessibility',
];

test.describe('main site pages', () => {
  for (const locale of ['en', 'he'] as const) {
    for (const path of mainPages) {
      const url = (locale === 'he' ? '/he' : '') + (path === '/' ? '' : path) || '/';
      test(`${url}: clean console, no CSP violation, lang/dir, SEO tags`, async ({ page, request }) => {
        expect((await request.get(MAIN + url)).status(), url).toBe(200);

        const w = await watch(page, MAIN);
        await page.goto(MAIN + url);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await scrollThrough(page);

        expect(await page.locator('html').getAttribute('lang')).toBe(locale);
        expect(await page.locator('html').getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
        expect((await page.title()).length).toBeGreaterThan(5);
        expect(await meta(page, 'meta[name=description]')).toBeTruthy();
        expect(strip(await meta(page, 'link[rel=canonical]', 'href'))).toBe(strip(MAIN + url));
        const hreflangs = await page.locator('link[rel=alternate][hreflang]').evaluateAll((els) => els.map((e) => e.getAttribute('hreflang')));
        expect(hreflangs).toEqual(expect.arrayContaining(['en', 'he']));
        expect(await meta(page, 'meta[property="og:title"]')).toBeTruthy();
        // structured data must be valid JSON
        for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
          expect(() => JSON.parse(raw), `invalid JSON-LD on ${url}`).not.toThrow();
        }
        expect(await page.locator('h1').count(), 'exactly one h1').toBe(1);
        expect(await w.violations(), 'CSP violations').toEqual([]);
        expect(w.problems).toEqual([]);
      });
    }
  }
});
