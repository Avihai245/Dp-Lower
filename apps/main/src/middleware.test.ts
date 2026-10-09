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
