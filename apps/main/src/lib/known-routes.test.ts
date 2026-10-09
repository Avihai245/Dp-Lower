import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ARTICLE_SLUGS, SERVICE_SLUGS, TEAM_SLUGS } from '@dpl/i18n/slugs';
import { describe, expect, it } from 'vitest';
import { sitePages } from './crawl';
import { isKnownPath, missingPageLocale, SLUG_COLLECTIONS, STATIC_PATHS } from './known-routes';

const SITE_DIR = path.join(import.meta.dirname, '../app/[locale]/(site)');

/** Every page.tsx under (site) as a route: route groups removed, [slug] kept, catch-alls and the 404 page left out. */
function routes(dir = SITE_DIR, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === 'page.tsx') out.push(prefix || '/');
      continue;
    }
    if (name.startsWith('[...') || name === 'page-not-found') continue;
    out.push(...routes(full, name.startsWith('(') ? prefix : `${prefix}/${name}`));
  }
  return out;
}

describe('known routes', () => {
  it('the static list is exactly the slugless pages of the app directory', () => {
    const found = routes().filter((r) => !r.includes('['));
    expect([...STATIC_PATHS].sort()).toEqual(found.sort());
  });

  it('the slug collections are exactly the [slug] folders of the app directory', () => {
    const found = routes()
      .filter((r) => r.endsWith('/[slug]'))
      .map((r) => r.split('/')[1]);
    expect(Object.keys(SLUG_COLLECTIONS).sort()).toEqual(found.sort());
  });

  it('every page of the sitemap is known, and nothing else is', () => {
    const sitemap = sitePages().map((p) => p.path);
    expect(sitemap.length).toBe(
      STATIC_PATHS.length + SERVICE_SLUGS.length + TEAM_SLUGS.length + ARTICLE_SLUGS.length,
    );
    for (const p of sitemap) expect(isKnownPath(p), p).toBe(true);
  });

  it('answers for mistyped slugs, other folders and look-alikes', () => {
    for (const p of [
      '/nope',
      '/services/nope',
      '/team/nobody',
      '/insights/nothing',
      '/about/team',
      '/services/german-citizenship/x',
      '/ABOUT',
      '//about',
      '/page-not-found',
      '/admin',
      '/portal',
    ]) {
      expect(isKnownPath(p), p).toBe(false);
    }
  });

  it('ignores one trailing slash', () => {
    expect(isKnownPath('/about/')).toBe(true);
    expect(isKnownPath('/services/german-citizenship/')).toBe(true);
    expect(isKnownPath('/')).toBe(true);
  });

  it('missingPageLocale picks the language from the prefix', () => {
    expect(missingPageLocale('/nope')).toBe('en');
    expect(missingPageLocale('/he/nope')).toBe('he');
    expect(missingPageLocale('/he/services/nope')).toBe('he');
    expect(missingPageLocale('/en/nope')).toBe('en');
    expect(missingPageLocale('/hex')).toBe('en');
    expect(missingPageLocale('/he-IL/about')).toBe('en');
  });

  it('missingPageLocale lets every real page through, with or without a prefix', () => {
    for (const p of sitePages().map((x) => x.path)) {
      expect(missingPageLocale(p), p).toBeNull();
      expect(missingPageLocale(p === '/' ? '/he' : `/he${p}`), `/he${p}`).toBeNull();
      expect(missingPageLocale(p === '/' ? '/en' : `/en${p}`), `/en${p}`).toBeNull();
    }
    expect(missingPageLocale('/he/')).toBeNull();
  });
});
