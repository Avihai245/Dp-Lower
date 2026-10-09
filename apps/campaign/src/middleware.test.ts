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
});
afterEach(() => vi.unstubAllEnvs());

describe('platform deep links (?entry=)', () => {
  it('sends eligibility straight to the quiz and records where the visit came from', async () => {
    const res = (await get('/?entry=eligibility&source=main-site&utm_medium=email')) as NextResponse;
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/eligibility');
    expect(res.cookies.get('dpl_src')?.value).toBe('main-site');
    expect(JSON.parse(res.cookies.get('dpl_utm')!.value)).toEqual({ utm_medium: 'email' });
    expect(session.calls).toBe(0); // no Supabase round trip for the quiz
  });

  it('keeps the language prefix', async () => {
    const res = await get('/he?entry=eligibility');
    expect(location(res)).toBe('/he/eligibility');
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

  it('ignores unknown entries and entries on other pages', async () => {
    expect(await get('/?entry=bogus')).toMatchObject({ status: 200 });
    expect(location(await get('/privacy?entry=eligibility'))).not.toBe('/eligibility');
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

  it('lets signed-in visitors through, and does not ask Supabase about public pages', async () => {
    session.user = { id: 'u1' };
    expect((await get('/portal')).status).toBe(200);
    session.calls = 0;
    await get('/');
    await get('/privacy');
    expect(session.calls).toBe(0);
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

  it('single segments with a dot reach the middleware; folders, the API and the build output do not; emailed /go links do', () => {
    for (const p of ['/', '/he/eligibility', '/favicon.ico', '/wp-login.php', '/.env']) expect(matched(p), p).toBe(true);
    for (const p of ['/api/leads', '/_next/static/a.js', '/images/DPL_logo.webp', '/email/dpl-logo.png', '/he/favicon.ico']) expect(matched(p), p).toBe(false);
    expect(config.matcher).toContain('/go/:path*');
    expect(config.matcher).toContain('/he/go/:path*');
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

  it('a visitor in Israel is not redirected anywhere: the country default belongs to the bilingual setting', async () => {
    for (const p of ['/', '/eligibility', '/privacy', '/sign-in']) {
      expect((await page(p, { 'x-vercel-ip-country': 'IL' })).status, p).toBe(200);
    }
  });
});

describe('the language a visitor starts in (bilingual setting)', () => {
  const page = (url: string, headers: Record<string, string> = {}) =>
    middleware(new NextRequest(`http://localhost:3001${url}`, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/126', ...headers } }));
  const IL = { 'x-vercel-ip-country': 'IL' };

  it('a visitor in Israel who opens an English entry page is taken to the Hebrew edition, with the query and the first-touch cookies kept', async () => {
    const res = (await page('/?utm_source=google&source=ad', IL)) as NextResponse;
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/he?utm_source=google&source=ad');
    expect(cookieNames(res)).toEqual(expect.arrayContaining(['dpl_src', 'dpl_utm']));
    for (const [from, to] of [['/eligibility', '/he/eligibility'], ['/privacy', '/he/privacy'], ['/sign-in', '/he/sign-in']] as const) {
      expect(location(await page(from, IL)), from).toBe(to);
    }
    // a deep link goes to the Hebrew edition first, and from there to the right screen
    expect(location(await page('/?entry=eligibility&source=main-site', IL))).toBe('/he?entry=eligibility&source=main-site');
  });

  it('inside the funnel and the portal the lead keeps its own language: nothing is redirected there', async () => {
    for (const p of ['/details', '/booking', '/offer', '/portal', '/go/abc.def', '/unsubscribe', '/open-link']) {
      expect((await page(p, IL)).status === 307 && location(await page(p, IL)).startsWith('/he'), p).toBe(false);
    }
  });

  it('anyone else gets English; an explicit choice wins in both directions; the link from the firm site says ?lang=en', async () => {
    expect((await page('/', { 'x-vercel-ip-country': 'US' })).status).toBe(200);
    expect((await page('/', { ...IL, cookie: 'dpl_lang=en' })).status).toBe(200);
    const fromFirmSite = (await page('/eligibility?source=main-site&lang=en', IL)) as NextResponse;
    expect(fromFirmSite.status).toBe(200);
    expect(fromFirmSite.cookies.get('dpl_lang')?.value).toBe('en');
    expect(location(await page('/', { 'x-vercel-ip-country': 'DE', cookie: 'dpl_lang=he' }))).toBe('/he');
    expect((await page('/he', IL)).status).toBe(200);
  });

  it('crawlers are never redirected', async () => {
    expect((await page('/', { ...IL, 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).status).toBe(200);
    expect((await page('/', { ...IL, accept: '*/*' })).status).toBe(200);
  });
});
