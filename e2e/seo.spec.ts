import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Walks the whole sitemap of the firm's site with plain HTTP requests (no browser, so it is fast) and checks what search
 * engines and AI crawlers rely on: every URL answers 200 in the right language and direction with one h1, a title, a
 * description, a self-referencing canonical, reciprocal en/he alternates and valid structured data; every internal
 * link and image on those pages resolves; robots.txt and llms.txt point at things that exist.
 *
 * The firm's site also carries the landing page and the eligibility funnel under /apply (its sitemap lists /apply and
 * /apply/privacy, the quiz steps stay out of it and are noindex). The client portal (CAMPAIGN) has no public content any
 * more: its sitemap is empty on purpose, its pages are private, and its old landing addresses redirect to /apply.
 *
 *   CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm exec playwright test e2e/seo.spec.ts
 */
const CAMPAIGN = process.env.CAMPAIGN_URL ?? 'http://localhost:3001';
const MAIN = process.env.MAIN_URL ?? 'http://localhost:3000';

test.setTimeout(240_000);

const strip = (u: string) => u.replace(/\/+$/, '');
const attr = (tag: string, name: string): string | null => new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(tag)?.[1] ?? null;
const unescape = (v: string) => v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

async function sitemapUrls(request: APIRequestContext, origin: string): Promise<string[]> {
  const res = await request.get(`${origin}/sitemap.xml`);
  expect(res.status()).toBe(200);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => unescape(m[1]!));
}

interface Page {
  status: number;
  html: string;
  lang: string | null;
  dir: string | null;
  title: string;
  description: string | null;
  canonical: string | null;
  alternates: Record<string, string>;
  robots: string | null;
  h1: number;
  ld: unknown[];
  links: string[];
  images: string[];
}

async function read(request: APIRequestContext, url: string): Promise<Page> {
  const res = await request.get(url);
  const html = await res.text();
  const htmlTag = /<html[^>]*>/i.exec(html)?.[0] ?? '';
  const tags = (re: RegExp) => [...html.matchAll(re)].map((m) => m[0]);
  const alternates: Record<string, string> = {};
  for (const tag of tags(/<link\b[^>]*rel="alternate"[^>]*>/gi)) {
    const lang = attr(tag, 'hreflang');
    const href = attr(tag, 'href');
    if (lang && href) alternates[lang] = href;
  }
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as unknown);
  return {
    status: res.status(),
    html,
    lang: attr(htmlTag, 'lang'),
    dir: attr(htmlTag, 'dir'),
    title: unescape(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? ''),
    description: tags(/<meta\b[^>]*name="description"[^>]*>/gi).map((t) => attr(t, 'content'))[0] ?? null,
    canonical: tags(/<link\b[^>]*rel="canonical"[^>]*>/gi).map((t) => attr(t, 'href'))[0] ?? null,
    alternates,
    robots: tags(/<meta\b[^>]*name="robots"[^>]*>/gi).map((t) => attr(t, 'content'))[0] ?? null,
    h1: (html.match(/<h1[\s>]/g) ?? []).length,
    ld,
    links: [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)].map((m) => unescape(m[1]!)),
    images: [...html.matchAll(/<img\b[^>]*\bsrc="(\/[^"]*)"/g)].map((m) => unescape(m[1]!)),
  };
}

const norm = (v: string) => v.replace(/\s+/g, ' ').trim();
/** The visible text of a page: tags and scripts removed, entities decoded. */
const textOf = (html: string) =>
  norm(unescape(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
const faqQuestions = (ld: unknown[]): string[] =>
  ld.flatMap((b) => {
    const nodes = [b as Record<string, unknown>, ...(((b as { '@graph'?: unknown[] })['@graph'] ?? []) as Record<string, unknown>[])];
    return nodes
      .filter((n) => n['@type'] === 'FAQPage')
      .flatMap((n) => ((n['mainEntity'] ?? []) as { name?: string }[]).map((q) => q.name ?? ''))
      .filter(Boolean);
  });

const ldTypes = (ld: unknown[]): string[] =>
  ld.flatMap((b) => {
    const node = b as { '@type'?: string | string[]; '@graph'?: { '@type'?: string | string[] }[] };
    const own = node['@type'] ? [node['@type']].flat() : [];
    return [...own, ...(node['@graph'] ?? []).flatMap((g) => (g['@type'] ? [g['@type']].flat() : []))];
  });

test.describe('main site', () => {
  test('every sitemap URL is a healthy, well-formed, indexable page', async ({ request }) => {
    const urls = await sitemapUrls(request, MAIN);
    expect(urls.length).toBeGreaterThan(100);
    // the funnel: its entry page and privacy page are listed; the steps of the quiz are not content to land on
    const listed = urls.map((u) => new URL(u).pathname);
    expect(listed).toEqual(expect.arrayContaining(['/apply', '/apply/privacy']));
    for (const step of ['eligibility', 'details', 'booking', 'offer']) {
      expect(listed, step).not.toContain(`/apply/${step}`);
      expect(listed, step).not.toContain(`/he/apply/${step}`);
    }
    // the Hebrew edition of the funnel is on in a bilingual build (NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he), off otherwise
    const hebrewFunnel = listed.includes('/he/apply');
    const internal = new Map<string, string>(); // path -> first page that links to it
    const failures: string[] = [];

    for (const url of urls) {
      const path = new URL(url).pathname;
      const he = path === '/he' || path.startsWith('/he/');
      const p = await read(request, MAIN + path);
      const fail = (what: string) => failures.push(`${path}: ${what}`);

      if (p.status !== 200) {
        fail(`status ${p.status}`);
        continue;
      }
      if (p.lang !== (he ? 'he' : 'en')) fail(`lang=${p.lang}`);
      if (p.dir !== (he ? 'rtl' : 'ltr')) fail(`dir=${p.dir}`);
      if (p.title.trim().length < 5) fail('missing title');
      if (!p.description || p.description.length < 30) fail('missing or tiny description');
      if (strip(p.canonical ?? '') !== strip(MAIN + path)) fail(`canonical=${p.canonical}`);
      const bare = path.replace(/^\/he/, '') || '/';
      // the landing page and its privacy page (the funnel on this site) are a different kind of page: no breadcrumb, no
      // site-wide data; what they must carry is checked below. Without the Hebrew edition they have no alternates at all.
      const funnel = /^\/apply(\/|$)/.test(bare);
      const other = he ? path.replace(/^\/he/, '') || '/' : '/he' + (path === '/' ? '' : path);
      if (!funnel || hebrewFunnel) {
        if (strip(p.alternates[he ? 'en' : 'he'] ?? '') !== strip(MAIN + other)) fail(`alternate ${he ? 'en' : 'he'}=${p.alternates[he ? 'en' : 'he']}`);
        if (strip(p.alternates[he ? 'he' : 'en'] ?? '') !== strip(MAIN + path)) fail('alternate for itself');
        if (!p.alternates['x-default']) fail('no x-default');
      }
      if (/noindex/i.test(p.robots ?? '')) fail('noindex');
      if (p.h1 !== 1) fail(`${p.h1} h1`);
      if (p.ld.length === 0 && !funnel) fail('no structured data');

      const types = ldTypes(p.ld);
      if (bare === '/apply') {
        // the landing page: the firm, the service it offers and the questions it answers (checked against the page below)
        if (!types.some((t) => /LegalService|Organization/.test(t))) fail(`landing page lacks the firm (${types.join(',')})`);
        if (!types.includes('Service')) fail(`landing page lacks Service (${types.join(',')})`);
        if (!types.includes('FAQPage')) fail(`landing page lacks FAQPage (${types.join(',')})`);
      }
      if (/^\/services\/[^/]+$/.test(bare) && !types.includes('Service')) fail(`service page lacks Service (${types.join(',')})`);
      // FAQPage data must be what the page shows: every marked-up question is visible on the page
      if (types.includes('FAQPage')) {
        const visible = textOf(p.html);
        for (const q of faqQuestions(p.ld)) if (!visible.includes(norm(q))) fail(`FAQ question not visible on the page: ${q.slice(0, 60)}`);
      }
      if (/^\/team\/[^/]+$/.test(bare) && !types.includes('Person')) fail(`team page lacks Person (${types.join(',')})`);
      if (/^\/insights\/[^/]+$/.test(bare) && !types.includes('Article')) fail(`article lacks Article (${types.join(',')})`);
      if (bare !== '/' && !funnel && !types.includes('BreadcrumbList')) fail('no BreadcrumbList');
      // the firm and the site are on every page (the pages that name #firm must carry it: Google does not follow ids across pages)
      if (!funnel && !types.some((t) => /LegalService|Organization/.test(t))) fail('no firm structured data (LegalService)');
      if (!funnel && !types.includes('WebSite')) fail('no WebSite structured data');
      // the link preview image is the prepared 1200x630 one, with its size (a person's page shows their own portrait)
      if (!/^\/team\/[^/]+$/.test(bare) && !/property="og:image:width" content="1200"/.test(p.html)) fail('og:image has no size');
      if (!/property="og:image:alt"/.test(p.html)) fail('og:image has no alt text');

      for (const l of p.links) if (!internal.has(l)) internal.set(l, path);
      for (const i of p.images) if (!internal.has(i)) internal.set(i, path);
    }
    expect(failures).toEqual([]);

    // every internal link and local image on those pages resolves
    const broken: string[] = [];
    for (const [target, from] of internal) {
      if (/^\/(api|_next)\//.test(target)) continue;
      // (the "Track my application" links of the landing page are absolute links to the portal: not internal, checked below)
      const res = await request.get(MAIN + target, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${from} -> ${target}: ${res.status()}`);
    }
    expect(broken).toEqual([]);
  });

  test('robots.txt, llms.txt and llms-full.txt are consistent with the site', async ({ request }) => {
    const robots = await (await request.get(`${MAIN}/robots.txt`)).text();
    expect(robots).toContain(`Sitemap: ${MAIN}/sitemap.xml`);
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) expect(robots).toContain(`User-Agent: ${bot}`);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);

    // the full text carries the campaign's common questions, as the design handoff file does
    const full = await (await request.get(`${MAIN}/llms-full.txt`)).text();
    expect(full).toContain('\n# German & Austrian citizenship — common questions\n');
    expect(full).toContain('Q: Do I need to speak German?');
    const fullHe = await (await request.get(`${MAIN}/he/llms-full.txt`)).text();
    expect(fullHe).toContain('\n# אזרחות גרמנית ואוסטרית: שאלות נפוצות\n');

    for (const file of ['/llms.txt', '/llms-full.txt', '/he/llms.txt', '/he/llms-full.txt']) {
      const res = await request.get(MAIN + file);
      expect(res.status(), file).toBe(200);
      expect(res.headers()['content-type'], file).toContain('text/plain');
      const text = await res.text();
      expect(text.length, file).toBeGreaterThan(500);
      // every link in them is a page of this site that answers
      const links = [...text.matchAll(/\]\((http[^)]+)\)/g)].map((m) => m[1]!).filter((l) => l.startsWith(MAIN));
      for (const link of new Set(links)) expect((await request.get(link)).status(), `${file} -> ${link}`).toBe(200);
    }
  });

  test('old query and hash style URLs are redirected to the clean ones', async ({ request }) => {
    const r = await request.get(`${MAIN}/?lang=he`, { maxRedirects: 0 });
    expect([301, 308]).toContain(r.status());
    expect(r.headers()['location']).toMatch(/\/he\/?$/);
    const p = await request.get(`${MAIN}/?p=services`, { maxRedirects: 0 });
    expect([301, 308]).toContain(p.status());
    expect(p.headers()['location']).toContain('/services');
    // campaign tracking on an old link must survive the redirect
    const tracked = await request.get(`${MAIN}/?p=service/german-citizenship&lang=he&utm_source=google&utm_campaign=spring`, { maxRedirects: 0 });
    expect(tracked.status()).toBe(301);
    const target = new URL(tracked.headers()['location']!, MAIN);
    expect(target.pathname).toBe('/he/services/german-citizenship');
    expect(Object.fromEntries(target.searchParams)).toEqual({ utm_source: 'google', utm_campaign: 'spring' });
  });

  test('unknown URLs answer 404 with a complete, server-rendered page: title, heading, language and noindex without scripts', async ({ request }) => {
    for (const [path, lang, dir, title, heading] of [
      ['/no-such-page', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      ['/services/no-such-service', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      ['/insights/nothing-here', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      ['/he/no-such-page', 'he', 'rtl', 'הדף לא נמצא | דקר פקס לוי, משרדי עורכי דין', 'הדף לא נמצא'],
      ['/he/team/nobody', 'he', 'rtl', 'הדף לא נמצא | דקר פקס לוי, משרדי עורכי דין', 'הדף לא נמצא'],
      ['/page-not-found', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      ['/about/team', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      // the funnel has four steps and a privacy page: any other address under /apply is an ordinary 404
      ['/apply/no-such-step', 'en', 'ltr', 'Page not found | Decker Pex Levi Law Offices', 'Page not found'],
      ['/he/apply/no-such-step', 'he', 'rtl', 'הדף לא נמצא | דקר פקס לוי, משרדי עורכי דין', 'הדף לא נמצא'],
    ] as const) {
      const p = await read(request, MAIN + path);
      expect(p.status, path).toBe(404);
      expect(p.html, `${path}: an empty client-side shell`).not.toContain('__next_error__');
      expect(p.lang, path).toBe(lang);
      expect(p.dir, path).toBe(dir);
      expect(p.title, path).toBe(title);
      expect(p.h1, path).toBe(1);
      expect(textOf(p.html), `${path}: the explanation is in the HTML`).toContain(heading);
      expect(p.robots ?? '', path).toContain('noindex');
      expect(p.canonical, `${path}: a 404 has no canonical`).toBeNull();
      expect(Object.keys(p.alternates), `${path}: nor alternates`).toEqual([]);
    }
  });

  test('the 404 page shows the site shell in the visitor language', async ({ page }) => {
    for (const [path, lang, dir, heading] of [['/no-such-page', 'en', 'ltr', 'Page not found'], ['/he/no-such-page', 'he', 'rtl', 'הדף לא נמצא']] as const) {
      const res = await page.goto(MAIN + path);
      expect(res?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText(heading);
      await expect(page.locator('header').first()).toBeVisible();
      expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      expect(await page.locator('html').getAttribute('dir')).toBe(dir);
    }
  });
});

test.describe('campaign site (the client portal)', () => {
  test('the sitemap is empty on purpose, and the pages around the sign-in are not indexable', async ({ request }) => {
    // the portal has no public content of its own: the landing page and the funnel are the firm's /apply
    const res = await request.get(`${CAMPAIGN}/sitemap.xml`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect(await sitemapUrls(request, CAMPAIGN)).toEqual([]);
    for (const hidden of ['/eligibility', '/details', '/booking', '/offer', '/sign-in', '/portal', '/admin', '/open-link', '/apply']) {
      expect(body, hidden).not.toContain(`${CAMPAIGN}${hidden}`);
    }
    for (const path of ['/sign-in', '/he/sign-in', '/link-expired', '/he/link-expired']) {
      const p = await read(request, CAMPAIGN + path);
      expect(p.status, path).toBe(200);
      expect(p.robots ?? '', path).toContain('noindex');
    }
  });

  test('robots.txt keeps the private areas out for every crawler and points at the sitemap', async ({ request }) => {
    const robots = await (await request.get(`${CAMPAIGN}/robots.txt`)).text();
    expect(robots).toContain(`Sitemap: ${CAMPAIGN}/sitemap.xml`);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);
    for (const group of robots.split(/\n\s*\n/).filter((g) => /User-Agent:/i.test(g))) {
      const agent = /User-Agent:\s*(.+)/i.exec(group)![1]!;
      for (const path of ['/api/', '/portal', '/admin', '/sign-in', '/create-password', '/go/', '/enter/', '/auth/', '/unsubscribe']) {
        expect(group, `${agent}: ${path}`).toContain(`Disallow: ${path}`);
        expect(group, `${agent}: /he${path}`).toContain(`Disallow: /he${path}`);
      }
    }
  });

  test('llms.txt says what this site is and points at the sign-in and at the eligibility check on the firm\'s site', async ({ request }) => {
    for (const file of ['/llms.txt', '/llms-full.txt']) {
      const res = await request.get(CAMPAIGN + file);
      expect(res.status(), file).toBe(200);
      expect(res.headers()['content-type'], file).toContain('text/plain');
      const text = await res.text();
      expect(text, file).toContain('sign-in');
      expect(text, file).toContain(`${CAMPAIGN}/sign-in`);
      expect(text, file).toContain(`${MAIN}/apply`);
      for (const link of new Set([...text.matchAll(/(https?:\/\/[^\s)\]]+)/g)].map((m) => m[1]!.replace(/[.,]$/, '')))) {
        if (link.startsWith(CAMPAIGN) || link.startsWith(MAIN)) expect((await request.get(link)).status(), `${file} -> ${link}`).toBe(200);
      }
    }
  });

  test('the old landing addresses redirect permanently to the firm\'s /apply pages, keeping the language and the tracking', async ({ request }) => {
    const target = new URL(MAIN);
    for (const [from, to] of [
      ['/eligibility', '/apply/eligibility'],
      ['/booking', '/apply/booking'],
      ['/offer', '/apply/offer'],
      ['/details', '/apply/details'],
      ['/privacy', '/apply/privacy'],
      ['/he/eligibility', '/he/apply/eligibility'],
      ['/he/booking', '/he/apply/booking'],
      ['/he/offer', '/he/apply/offer'],
      ['/he/details', '/he/apply/details'],
      ['/he/privacy', '/he/apply/privacy'],
      ['/ger-aus', '/apply'],
      ['/he/ger-aus', '/he/apply'],
    ] as const) {
      const res = await request.get(`${CAMPAIGN}${from}?utm_source=google&utm_campaign=spring`, { maxRedirects: 0 });
      expect([301, 308], from).toContain(res.status());
      const location = new URL(res.headers().location!, CAMPAIGN);
      expect(location.origin, from).toBe(target.origin);
      expect(location.pathname, from).toBe(to);
      expect(Object.fromEntries(location.searchParams), `${from}: the campaign parameters survive`).toEqual({ utm_source: 'google', utm_campaign: 'spring' });
    }
    // and following them ends on a page of the firm's site
    for (const [from, to] of [['/eligibility', '/apply/eligibility'], ['/he/privacy', '/he/apply/privacy'], ['/ger-aus', '/apply'], ['/ger-aus/', '/apply']] as const) {
      const res = await request.get(`${CAMPAIGN}${from}`);
      expect(res.status(), from).toBe(200);
      expect(new URL(res.url()).origin, from).toBe(target.origin);
      expect(new URL(res.url()).pathname, from).toBe(to);
    }
  });

  test('its bare address is the sign-in page; a deep link that asks for the eligibility check goes to the firm\'s site with its tracking', async ({ request }) => {
    for (const [from, to] of [['/', '/sign-in'], ['/he', '/he/sign-in'], ['/?entry=signin', '/sign-in']] as const) {
      const res = await request.get(CAMPAIGN + from, { maxRedirects: 0 });
      expect([307, 308], from).toContain(res.status());
      expect(new URL(res.headers().location!, CAMPAIGN).pathname, from).toBe(to);
    }
    for (const [from, path] of [['/', '/apply'], ['/he', '/he/apply']] as const) {
      const res = await request.get(`${CAMPAIGN}${from}?entry=eligibility&source=google-ads&utm_campaign=spring`, { maxRedirects: 0 });
      expect([307, 308], from).toContain(res.status());
      const location = new URL(res.headers().location!, CAMPAIGN);
      expect(location.origin).toBe(new URL(MAIN).origin);
      expect(location.pathname).toBe(path);
      // `entry` itself is spent, everything else is the visit's attribution
      expect(Object.fromEntries(location.searchParams)).toEqual({ source: 'google-ads', utm_campaign: 'spring' });
    }
  });
});

test.describe('landing page and funnel (the firm site, /apply)', () => {
  test('the landing page carries the structured data it promises (FAQ, organization) and valid JSON-LD', async ({ request }) => {
    for (const path of ['/apply', '/he/apply']) {
      const p = await read(request, MAIN + path);
      if (path.startsWith('/he') && p.status !== 200) continue;
      const types = ldTypes(p.ld);
      expect(types, path).toEqual(expect.arrayContaining(['FAQPage']));
      expect(types.some((t) => /LegalService|Organization/.test(t)), path).toBe(true);
      // every marked-up question is on the page
      const visible = textOf(p.html);
      expect(faqQuestions(p.ld).length, path).toBeGreaterThan(3);
      for (const q of faqQuestions(p.ld)) expect(visible, `${path}: ${q.slice(0, 60)}`).toContain(norm(q));
    }
  });

  test('the steps of the quiz are noindex and not in the sitemap, the landing page and its privacy page are indexable', async ({ request }) => {
    for (const path of ['/apply/eligibility', '/apply/details', '/apply/booking', '/apply/offer']) {
      const p = await read(request, MAIN + path);
      expect(p.status, path).toBe(200);
      expect(p.robots ?? '', path).toContain('noindex');
    }
    for (const path of ['/apply', '/apply/privacy']) {
      const p = await read(request, MAIN + path);
      expect(p.status, path).toBe(200);
      expect(p.robots ?? '', path).not.toContain('noindex');
      expect(strip(p.canonical ?? ''), path).toBe(strip(MAIN + path));
    }
  });

  test('every internal link and image on the landing page and its privacy page resolves', async ({ request }) => {
    const broken: string[] = [];
    for (const page of ['/apply', '/he/apply', '/apply/privacy', '/he/apply/privacy']) {
      const p = await read(request, MAIN + page);
      if (page.startsWith('/he') && p.status !== 200) continue;
      // (internal links only: the sign-in links are absolute links to the portal and are checked on their own below. The privacy
      // page has exactly three: the logo and the way back, both to the home page, and the firm's privacy policy)
      expect(p.links.length, page).toBeGreaterThanOrEqual(page.endsWith('/privacy') ? 3 : 4);
      if (page.endsWith('/privacy')) expect(p.links, page).toContain(page.startsWith('/he') ? '/he/privacy' : '/privacy');
      for (const target of new Set([...p.links, ...p.images])) {
        if (/^\/(api|_next)\//.test(target)) continue;
        const res = await request.get(MAIN + target, { maxRedirects: 5 });
        if (res.status() >= 400) broken.push(`${page} -> ${target}: ${res.status()}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test('the "Track my application" links of the landing page lead to the portal\'s sign-in, in the visitor language', async ({ request }) => {
    // Both links (header and footer) are absolute links to the portal (campaignUrl in lib/shell/campaign.ts): they used to be
    // relative /sign-in links, which are a 404 on the firm's site.
    for (const [path, prefix] of [['/apply', ''], ['/he/apply', '/he']] as const) {
      const p = await read(request, MAIN + path);
      if (prefix && p.status !== 200) continue;
      const hrefs = [...p.html.matchAll(/<a\b[^>]*\bhref="([^"]*sign-in[^"]*)"/g)].map((m) => unescape(m[1]!));
      expect(hrefs.length, `${path}: the sign-in links (header and footer)`).toBeGreaterThanOrEqual(2);
      for (const href of hrefs) {
        // absolute links to the portal (a relative one would be the firm's own 404), saying where the visitor came from
        expect(new URL(href).origin, `${path}: ${href} is a link to the portal`).toBe(new URL(CAMPAIGN).origin);
        expect(href, path).toMatch(/^https?:\/\//);
        expect(new URL(href).searchParams.get('source'), href).toBe('main-site');
        const res = await request.get(new URL(href, MAIN).toString());
        expect(res.status(), `${path}: ${href}`).toBe(200);
        expect(new URL(res.url()).origin, `${path}: ${href} opens the portal`).toBe(new URL(CAMPAIGN).origin);
        expect(new URL(res.url()).pathname, href).toBe(`${prefix}/sign-in`);
      }
    }
  });

  test('the calls to action lead into the funnel on this same site, in the visitor language', async ({ request }) => {
    for (const [path, prefix] of [['/apply', ''], ['/he/apply', '/he']] as const) {
      const p = await read(request, MAIN + path);
      if (prefix && p.status !== 200) continue;
      expect(p.links.filter((l) => l === `${prefix}/apply/eligibility`).length, `${path}: links to the quiz`).toBeGreaterThan(2);
      // none back to the old campaign addresses (those are redirects now)
      for (const l of p.links) expect(l, path).not.toMatch(/^\/(he\/)?(eligibility|booking|offer|details)(\/|$)/);
    }
  });
});
