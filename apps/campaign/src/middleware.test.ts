import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ user: null as { id: string } | null, calls: 0 }));
vi.mock('@dpl/db/middleware', () => ({
  refreshSession: async () => {
    session.calls++;
    return { user: session.user, supabase: null };
  },
}));

import middleware, { config } from './middleware';
import { ROOT_FILES } from './lib/root-files';

const get = (url: string, cookie?: string) =>
  middleware(new NextRequest(`http://localhost:3001${url}`, cookie ? { headers: { cookie } } : undefined));
const location = (res: Response) => (res.headers.get('location') ?? '').replace('http://localhost:3001', '');
const cookieNames = (res: NextResponse) => res.cookies.getAll().map((c) => c.name);

// the tests below were written for the bilingual setting; the English-only ones say so themselves
beforeEach(() => {
  session.user = null;
  session.calls = 0;
  vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_LOCALES', 'en,he');
  // the expected addresses are the production defaults, whatever the machine's .env.local says
  vi.stubEnv('NEXT_PUBLIC_MAIN_SITE_URL', undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('platform deep links (?entry=): this app has no landing page, so a bare visit and most deep links show the portal itself', () => {
  it('a bare visit to "/" (no entry at all — the portal\'s own domain) shows sign-in without a session and /portal with one', async () => {
    expect(location(await get('/'))).toBe('/sign-in');
    expect(session.calls).toBe(1); // deciding sign-in vs /portal needs a session check
    session.user = { id: 'u1' };
    expect(location(await get('/'))).toBe('/portal');
    expect(location(await get('/he'))).toBe('/he/portal');
  });

  it('sends an entry other than signin/portal (eligibility included) to the firm\'s apply page, and records where the visit came from', async () => {
    const res = (await get('/?entry=eligibility&source=main-site&utm_medium=email')) as NextResponse;
    expect(res.status).toBe(308);
    expect(location(res)).toBe('https://www.lawoffice.org.il/apply?source=main-site&utm_medium=email');
    expect(res.cookies.get('dpl_src')?.value).toBe('main-site');
    expect(JSON.parse(res.cookies.get('dpl_utm')!.value)).toEqual({ utm_medium: 'email' });
    expect(session.calls).toBe(0); // no Supabase round trip for an entry that needs no session
  });

  it('keeps the language prefix on the way out', async () => {
    const res = await get('/he?entry=eligibility');
    expect(location(res)).toBe('https://www.lawoffice.org.il/he/apply');
  });

  it('sends sign-in and portal entries to sign-in without a session and to the portal with one', async () => {
    expect(location(await get('/?entry=signin&source=main-site'))).toBe('/sign-in');
    expect(location(await get('/?entry=portal'))).toBe('/sign-in');
    session.user = { id: 'u1' };
    expect(location(await get('/?entry=signin'))).toBe('/portal');
    expect(location(await get('/he?entry=portal'))).toBe('/he/portal');
  });

  it('uses source "direct" when the deep link has none', async () => {
    const res = (await get('/?entry=eligibility')) as NextResponse;
    expect(res.cookies.get('dpl_src')?.value).toBe('direct');
  });

  it('treats an unknown, non-empty entry as an explicit deep link (leaves for the apply page), unlike a bare visit; the entry logic only ever applies at the root', async () => {
    const res = (await get('/?entry=bogus')) as NextResponse;
    expect(res.status).toBe(308);
    expect(location(res)).toBe('https://www.lawoffice.org.il/apply');
    expect(location(await get('/sign-in?entry=eligibility'))).toBe('');
  });
});

describe('first-touch attribution on normal visits', () => {
  it('sets the cookies on the first visit that carries source or utm parameters', async () => {
    const res = (await get('/?utm_source=google&utm_campaign=ger')) as NextResponse;
    expect(cookieNames(res)).toEqual(['dpl_src', 'dpl_utm']);
    expect(res.cookies.get('dpl_src')?.value).toBe('campaign-ger-aus');
  });

  it('sets nothing for a plain visit and never overwrites an earlier touch', async () => {
    expect(cookieNames((await get('/')) as NextResponse)).toEqual([]);
    expect(cookieNames((await get('/?utm_source=later', 'dpl_src=first')) as NextResponse)).toEqual([]);
    // a source on a later visit does not replace the first touch, but it does say where "Back to the site" goes
    const later = (await get('/?source=later', 'dpl_src=first')) as NextResponse;
    expect(cookieNames(later)).toEqual(['dpl_from']);
    expect(later.cookies.get('dpl_from')?.value).toBe('later');
  });
});

describe('protected pages', () => {
  it('redirects anonymous visitors of /portal and /admin to sign-in with a next parameter', async () => {
    const res = await get('/portal/documents?x=1');
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/sign-in?next=%2Fportal%2Fdocuments%3Fx%3D1');
    expect(location(await get('/he/admin'))).toBe('/he/sign-in?next=%2Fhe%2Fadmin');
  });

  it('lets signed-in visitors through, and does not ask Supabase about public pages other than the root', async () => {
    session.user = { id: 'u1' };
    expect((await get('/portal')).status).toBe(200);
    session.calls = 0;
    await get('/privacy');
    expect(session.calls).toBe(0); // '/' itself is session-aware now (it decides sign-in vs /portal), see the deep-links describe above
  });
});

describe('the explicit English prefix', () => {
  it('redirects permanently to the clean address, query string kept', async () => {
    for (const [from, to] of [['/en', '/'], ['/en/privacy', '/privacy'], ['/en/eligibility?source=main-site', '/eligibility?source=main-site']] as const) {
      const res = await get(from);
      expect(res.status, from).toBe(308);
      expect(location(res), from).toBe(to);
    }
    expect((await get('/entry')).status).toBe(200);
  });
});

describe('files at the root', () => {
  const matched = (p: string) => new RegExp(`^${config.matcher[0]}$`).test(p);

  it('single segments with a dot reach the middleware; folders, the API and the build output do not; emailed /go and /enter links do', () => {
    for (const p of ['/', '/he/eligibility', '/favicon.ico', '/wp-login.php', '/.env']) expect(matched(p), p).toBe(true);
    for (const p of ['/api/leads', '/_next/static/a.js', '/images/DPL_logo.webp', '/email/dpl-logo.png', '/he/favicon.ico']) expect(matched(p), p).toBe(false);
    expect(config.matcher).toContain('/go/:path*');
    expect(config.matcher).toContain('/he/go/:path*');
    expect(config.matcher).toContain('/enter/:path*');
    expect(config.matcher).toContain('/he/enter/:path*');
  });

  it('the icons, robots.txt, sitemap.xml and llms.txt are served as they are', async () => {
    for (const p of ROOT_FILES) {
      const res = await get(p);
      expect(res.status, p).toBe(200);
      expect(res.headers.get('x-middleware-next'), p).toBe('1');
    }
    expect(session.calls).toBe(0);
  });

  it('any other single segment with a dot is a 404, never a 500', async () => {
    for (const p of ['/wp-login.php', '/.env', '/index.html', '/ads.txt', '/favicon.ico.bak']) {
      const res = await get(p);
      expect(res.status, p).toBe(404);
      expect(res.headers.get('x-middleware-rewrite'), p).toContain('/en/page-not-found');
    }
  });
});

describe('English only (the setting by default)', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_LOCALES', 'en'));
  const page = (url: string, headers: Record<string, string> = {}) =>
    middleware(new NextRequest(`http://localhost:3001${url}`, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/126', ...headers } }));

  it('the Hebrew edition of the public pages is off: every address under /he goes to its English page, query kept', async () => {
    for (const [from, to] of [['/he', '/'], ['/he/', '/'], ['/he/eligibility?source=ad&utm_source=x', '/eligibility?source=ad&utm_source=x'], ['/he/privacy', '/privacy'], ['/he/portal', '/portal'], ['/he/go/abc.def', '/go/abc.def'], ['/he/sign-in?next=%2Fportal', '/sign-in?next=%2Fportal']] as const) {
      const res = await page(from);
      expect(res.status, from).toBe(307);
      expect(location(res), from).toBe(to);
    }
  });

  it('the staff area keeps its Hebrew interface', async () => {
    const res = await page('/he/admin');
    expect(res.status).toBe(307);
    // not redirected to English: the staff member is sent to sign in, in Hebrew
    expect(location(res)).toBe('/he/sign-in?next=%2Fhe%2Fadmin');
  });

  it('a visitor in Israel still sees the portal sign-in at "/": the bare-root-shows-the-portal behavior is unconditional, unlike the country default, which belongs to the bilingual setting and does not apply here', async () => {
    const root = (await page('/', { 'x-vercel-ip-country': 'IL' })) as NextResponse;
    expect(root.status).toBe(307);
    expect(location(root)).toBe('/sign-in');
    for (const p of ['/eligibility', '/privacy', '/sign-in']) {
      expect((await page(p, { 'x-vercel-ip-country': 'IL' })).status, p).toBe(200);
    }
  });
});

describe('the language a visitor starts in (bilingual setting)', () => {
  const page = (url: string, headers: Record<string, string> = {}) =>
    middleware(new NextRequest(`http://localhost:3001${url}`, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/126', ...headers } }));
  const IL = { 'x-vercel-ip-country': 'IL' };

  it('a visitor in Israel who opens "/" or "/sign-in" is taken to the Hebrew edition first, and only leaves for the apply page from there', async () => {
    const res = (await page('/?utm_source=google&source=ad', IL)) as NextResponse;
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/he?utm_source=google&source=ad');
    expect(cookieNames(res)).toEqual(expect.arrayContaining(['dpl_src', 'dpl_utm']));
    expect(location(await page('/sign-in', IL))).toBe('/he/sign-in');
    // a deep link goes to the Hebrew edition first, and only from there leaves for the firm's apply page
    expect(location(await page('/?entry=eligibility&source=main-site', IL))).toBe('/he?entry=eligibility&source=main-site');
  });

  it('inside the portal and the auth pages the lead keeps its own language: nothing is redirected there', async () => {
    for (const p of ['/portal', '/go/abc.def', '/unsubscribe', '/open-link', '/create-password']) {
      const res = await page(p, IL);
      expect(res.status === 307 && location(res).startsWith('/he'), p).toBe(false);
    }
  });

  it('anyone else sees the portal sign-in at "/"; an explicit choice wins in both directions; the link from the firm site says ?lang=en', async () => {
    const fromUS = (await page('/', { 'x-vercel-ip-country': 'US' })) as NextResponse;
    expect(fromUS.status).toBe(307);
    expect(location(fromUS)).toBe('/sign-in');
    const fromIlWithEnCookie = (await page('/', { ...IL, cookie: 'dpl_lang=en' })) as NextResponse;
    expect(fromIlWithEnCookie.status).toBe(307);
    expect(location(fromIlWithEnCookie)).toBe('/sign-in');
    const fromFirmSite = (await page('/sign-in?source=main-site&lang=en', IL)) as NextResponse;
    expect(fromFirmSite.status).toBe(200);
    expect(fromFirmSite.cookies.get('dpl_lang')?.value).toBe('en');
    expect(location(await page('/', { 'x-vercel-ip-country': 'DE', cookie: 'dpl_lang=he' }))).toBe('/he');
    const fromHe = (await page('/he', IL)) as NextResponse;
    expect(fromHe.status).toBe(307);
    expect(location(fromHe)).toBe('/he/sign-in');
  });

  it('shows the portal sign-in at "/" for crawlers too: the language-sniffing that is skipped for them only ever chose between English and Hebrew here, never whether to leave', async () => {
    const bot = (await page('/', { ...IL, 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' })) as NextResponse;
    expect(bot.status).toBe(307);
    expect(location(bot)).toBe('/sign-in');
    const nonHtml = (await page('/', { ...IL, accept: '*/*' })) as NextResponse;
    expect(nonHtml.status).toBe(307);
    expect(location(nonHtml)).toBe('/sign-in');
  });
});
