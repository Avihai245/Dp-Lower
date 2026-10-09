import { expect, test, type Page } from '@playwright/test';

/**
 * Cross-cutting checks on the built apps, in both languages: security headers, a Content-Security-Policy that nothing
 * the pages do violates, no script errors or hydration failures, the right lang/dir, and the SEO tags that every
 * indexable page needs (and that the funnel pages must not have). Run against `next start` servers:
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/hygiene.spec.ts
 */
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';

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
    ['campaign', CAMPAIGN, '/'],
    ['campaign', CAMPAIGN, '/sign-in'],
    ['main', MAIN, '/'],
    ['main', MAIN, '/team'],
  ] as const) {
    test(`${name} ${path}: the Hebrew page asks for its four font files with the page, the English one for none`, async ({ request }) => {
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
    // the one exception: the campaign header writes the other language's name, "עברית", in the Hebrew-capable family (7 KB)
    for (const url of [`${CAMPAIGN}/`, `${CAMPAIGN}/sign-in`, `${MAIN}/`, `${MAIN}/team`]) {
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
      expect(hebrew, url).toEqual(url.startsWith(CAMPAIGN) ? ['assistant-hebrew-wght-normal'] : []);
      expect(warnings, url).toEqual([]);
      page.removeAllListeners('response');
      page.removeAllListeners('console');
    }
  });

  test('a Hebrew page does not jump when its fonts arrive (a 412 px phone on a slow connection)', async ({ browser }) => {
    for (const url of [`${CAMPAIGN}/he`, `${MAIN}/he`]) {
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
  for (const [path, figures] of [['/', ['1,200+', '15+', '94%', '30+']], ['/he', ['1,200+', '15+', '94%', '30+']]] as const) {
    test(`campaign ${path}: the figures show their real values, not 0 (the count-up needs scripts)`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${CAMPAIGN}${path}`);
      const strip = page.locator('[data-count]');
      await strip.scrollIntoViewIfNeeded();
      for (const figure of figures) await expect(strip.locator('.dpl-sr-only', { hasText: new RegExp(`^${figure.replace(/[+]/g, '\\+')}$`) })).toBeVisible();
      // and nothing in it still reads "0+" or "0%"
      const text = (await strip.innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(/(^|\s)0[+%]/);
      await context.close();
    });
  }
});

test.describe('security headers', () => {
  for (const [name, origin] of [['campaign', CAMPAIGN], ['main', MAIN]] as const) {
    test(`${name}: every response carries the hardening headers and a strict CSP`, async ({ request }) => {
      for (const path of ['/', '/he']) {
        const res = await request.get(origin + path);
        expect(res.status(), path).toBe(200);
        const h = res.headers();
        expect(h['x-content-type-options']).toBe('nosniff');
        expect(h['x-frame-options']).toBe('SAMEORIGIN');
        expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(h['strict-transport-security']).toContain('max-age=');
        expect(h['permissions-policy']).toContain('camera=()');
        const csp = h['content-security-policy'] ?? '';
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("frame-ancestors 'self'");
        // nothing may be framed or scripted from anywhere but the services the pages really use
        for (const host of csp.match(/https?:\/\/[^\s;]+/g) ?? []) {
          expect(host, `unexpected host in the CSP: ${host}`).toMatch(/challenges\.cloudflare\.com|youtube(-nocookie)?\.com|i\.ytimg\.com|127\.0\.0\.1|localhost|\.supabase\.co/);
        }
        expect(csp).not.toContain("'unsafe-eval'");
      }
    });
  }
});

const campaignPages = [
  { path: '/', lang: 'en', dir: 'ltr', indexable: true },
  { path: '/he', lang: 'he', dir: 'rtl', indexable: true },
  { path: '/privacy', lang: 'en', dir: 'ltr', indexable: true },
  { path: '/he/privacy', lang: 'he', dir: 'rtl', indexable: true },
  { path: '/eligibility', lang: 'en', dir: 'ltr', indexable: false },
  { path: '/he/eligibility', lang: 'he', dir: 'rtl', indexable: false },
  { path: '/sign-in', lang: 'en', dir: 'ltr', indexable: false },
  { path: '/he/sign-in', lang: 'he', dir: 'rtl', indexable: false },
  { path: '/link-expired', lang: 'en', dir: 'ltr', indexable: false },
  { path: '/he/link-expired', lang: 'he', dir: 'rtl', indexable: false },
];

test.describe('campaign pages', () => {
  for (const p of campaignPages) {
    test(`${p.path}: clean console, no CSP violation, lang/dir, ${p.indexable ? 'indexable with alternates' : 'noindex'}`, async ({ page }) => {
      const w = await watch(page, CAMPAIGN);
      await page.goto(CAMPAIGN + p.path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await scrollThrough(page);

      expect(await page.locator('html').getAttribute('lang')).toBe(p.lang);
      expect(await page.locator('html').getAttribute('dir')).toBe(p.dir);
      expect(await page.title()).not.toBe('');
      const robots = await meta(page, 'meta[name=robots]');
      if (p.indexable) {
        expect(robots ?? '').not.toContain('noindex');
        // the canonical is built from the configured site URL, which for these servers is their own origin
        expect(strip(await meta(page, 'link[rel=canonical]', 'href'))).toBe(strip(CAMPAIGN + p.path));
        const hreflangs = await page.locator('link[rel=alternate][hreflang]').evaluateAll((els) => els.map((e) => e.getAttribute('hreflang')));
        expect(hreflangs).toEqual(expect.arrayContaining(['en', 'he']));
      } else {
        expect(robots).toContain('noindex');
      }
      expect(await w.violations(), 'CSP violations').toEqual([]);
      expect(w.problems).toEqual([]);
    });
  }

  test('the landing page: opening the chat, the advisor and the FAQ breaks nothing', async ({ page }) => {
    const w = await watch(page, CAMPAIGN);
    await page.goto(CAMPAIGN + '/');
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
