import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import middleware, { config } from './middleware';

const get = (url: string) => middleware(new NextRequest(`http://localhost:3000${url}`));
/** The matcher is a path-to-regexp pattern whose only group is a plain regular expression. */
const matched = (p: string) => new RegExp(`^${config.matcher[0]}$`).test(p);

describe('which requests reach the middleware', () => {
  it('pages and single segments with a dot do; the API, the build output and files in folders do not', () => {
    for (const p of ['/', '/he', '/about', '/he/services/german-citizenship', '/favicon.ico', '/wp-login.php', '/.env', '/index.html']) expect(matched(p), p).toBe(true);
    for (const p of ['/api/contact', '/_next/static/chunks/a.js', '/_vercel/insights/script.js', '/images/DPL_logo.webp', '/he/favicon.ico']) expect(matched(p), p).toBe(false);
  });
});

describe('files at the root', () => {
  it('the icons, robots.txt, sitemap.xml and llms.txt are served as they are', () => {
    for (const p of ['/favicon.ico', '/apple-touch-icon.png', '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']) {
      const res = get(p);
      expect(res.status, p).toBe(200);
      expect(res.headers.get('x-middleware-next'), p).toBe('1');
    }
  });

  it('any other single segment with a dot is a server-rendered 404, never a 500', () => {
    for (const p of ['/wp-login.php', '/.env', '/index.html', '/foo.html', '/ads.txt', '/favicon.ico.bak', '/sitemap-index.xml']) {
      const res = get(p);
      expect(res.status, p).toBe(404);
      expect(res.headers.get('x-middleware-rewrite'), p).toContain('/en/page-not-found');
    }
  });

  it('the explicit English prefix redirects permanently to the clean address, query string kept', () => {
    for (const [from, to] of [['/en', '/'], ['/en/', '/'], ['/en/about', '/about'], ['/en/services/german-citizenship?utm_source=x', '/services/german-citizenship?utm_source=x']] as const) {
      const res = get(from);
      expect(res.status, from).toBe(308);
      expect(res.headers.get('location'), from).toBe(`http://localhost:3000${to}`);
    }
    // not a prefix: a page whose name merely starts with "en"
    expect(get('/entry').status).toBe(404);
  });

  it('the old prototype links and the ordinary 404 still work', () => {
    expect(get('/?p=service/german-citizenship').status).toBe(301);
    expect(get('/nope').status).toBe(404);
    expect(get('/he/nope').headers.get('x-middleware-rewrite')).toContain('/he/page-not-found');
    expect(get('/about').status).toBe(200);
  });
});

describe('the language a visitor starts in', () => {
  const page = (url: string, headers: Record<string, string> = {}) =>
    middleware(new NextRequest(`http://localhost:3000${url}`, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/126', ...headers } }));
  const IL = { 'x-vercel-ip-country': 'IL' };

  it('a visitor in Israel who opens an English address is taken to the Hebrew edition, query kept, with a temporary redirect', () => {
    for (const [from, to] of [['/', '/he'], ['/about', '/he/about'], ['/services/german-citizenship?utm_source=x', '/he/services/german-citizenship?utm_source=x']] as const) {
      const res = page(from, IL);
      expect(res.status, from).toBe(307);
      expect(res.headers.get('location'), from).toBe(`http://localhost:3000${to}`);
      expect(res.cookies.get('dpl_lang'), 'the country is not remembered as a choice').toBeUndefined();
    }
  });

  it('anyone else gets English; a visitor in Israel who chose English keeps it; a Hebrew address is never redirected', () => {
    expect(page('/about', { 'x-vercel-ip-country': 'US' }).status).toBe(200);
    expect(page('/about').status).toBe(200);
    expect(page('/about', { ...IL, cookie: 'dpl_lang=en' }).status).toBe(200);
    expect(page('/about?lang=en', IL).status).toBe(200);
    expect(page('/he/about', IL).status).toBe(200);
    // somebody elsewhere who chose Hebrew earlier
    expect(page('/about', { 'x-vercel-ip-country': 'DE', cookie: 'dpl_lang=he' }).status).toBe(307);
  });

  it('?lang=he is a choice that is remembered; ?lang=en on an English address is remembered too', () => {
    const he = page('/about?lang=he');
    expect(he.status).toBe(307);
    expect(he.headers.get('location')).toBe('http://localhost:3000/he/about');
    expect(he.cookies.get('dpl_lang')?.value).toBe('he');
    expect(page('/about?lang=en', IL).cookies.get('dpl_lang')?.value).toBe('en');
  });

  it('the old ?lang= links keep their meaning as a choice: ?lang=en from Israel stays English', () => {
    const res = page('/?lang=en', IL);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(res.cookies.get('dpl_lang')?.value).toBe('en');
    expect(page('/?lang=he').cookies.get('dpl_lang')?.value).toBe('he');
  });

  it('crawlers, link previews and non-page requests are never redirected', () => {
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'Bingbot/2.0']) {
      expect(page('/about', { ...IL, 'user-agent': ua }).status, ua).toBe(200);
    }
    expect(page('/about', { ...IL, accept: '*/*' }).status).toBe(200);
    expect(middleware(new NextRequest('http://localhost:3000/about', { method: 'POST', headers: { ...IL, accept: 'text/html' } })).status).toBe(200);
    // files and the 404 page keep their behaviour
    expect(page('/robots.txt', IL).status).toBe(200);
    expect(page('/wp-login.php', IL).status).toBe(404);
  });
});
