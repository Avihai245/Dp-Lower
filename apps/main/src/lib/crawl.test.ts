import { ARTICLE_SLUGS, SERVICE_SLUGS, TEAM_SLUGS } from '@dpl/i18n';
import { describe, expect, it } from 'vitest';
import { articleIsoDate } from './dates';
import { CONTENT_UPDATED, robotsConfig, sitemapEntries, sitePages, WELCOMED_CRAWLERS } from './crawl';

const ORIGIN = 'https://www.lawoffice.org.il';

/** home, about, services, team, testimonials, insights, media, contact, privacy, terms, accessibility */
const STATIC_PAGES = 11;
const PAGES = STATIC_PAGES + SERVICE_SLUGS.length + TEAM_SLUGS.length + ARTICLE_SLUGS.length;

describe('sitePages', () => {
  const pages = sitePages();

  it('covers home, the static pages, 22 services, 37 attorneys and 8 articles', () => {
    expect(SERVICE_SLUGS).toHaveLength(22);
    expect(TEAM_SLUGS).toHaveLength(37);
    expect(ARTICLE_SLUGS).toHaveLength(8);
    expect(pages).toHaveLength(PAGES);
    expect(pages).toHaveLength(78);
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    for (const path of [
      '/',
      '/about',
      '/services',
      '/team',
      '/testimonials',
      '/insights',
      '/media',
      '/contact',
      '/privacy',
      '/terms',
      '/accessibility',
    ]) {
      expect(
        pages.map((p) => p.path),
        path,
      ).toContain(path);
    }
  });

  it('uses the design handoff priorities and truthful lastmod dates', () => {
    const by = Object.fromEntries(pages.map((p) => [p.path, p]));
    expect(by['/']!.priority).toBe(1);
    expect(by['/services']!.priority).toBe(0.9);
    expect(by['/services/german-citizenship']!.priority).toBe(0.9);
    expect(by['/team/anat-levi']!.priority).toBe(0.5);
    expect(by['/privacy']!.priority).toBe(0.2);
    for (const p of pages) {
      expect(p.priority).toBeGreaterThan(0);
      expect(p.priority).toBeLessThanOrEqual(1);
      expect(p.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(by['/insights/israel-work-visa-b1']!.lastModified).toBe(articleIsoDate('israel-work-visa-b1'));
    expect(by['/about']!.lastModified).toBe(CONTENT_UPDATED);
  });
});

describe('sitemapEntries', () => {
  const entries = sitemapEntries(ORIGIN);

  it('lists every page in both languages', () => {
    expect(entries).toHaveLength(PAGES * 2);
    expect(entries).toHaveLength(156);
  });

  it('has only absolute, clean, unique URLs under the site origin (nothing from the campaign app)', () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith(`${ORIGIN}/`) || url === ORIGIN).toBe(true);
      expect(() => new URL(url)).not.toThrow();
      expect(url).not.toMatch(/[?#]|\.html|euro-passports/);
    }
    expect(urls).toContain(`${ORIGIN}/`);
    expect(urls).toContain(`${ORIGIN}/he`);
    expect(urls).toContain(`${ORIGIN}/services/german-citizenship`);
    expect(urls).toContain(`${ORIGIN}/he/services/german-citizenship`);
    expect(urls).toContain(`${ORIGIN}/insights/israel-work-visa-b1`);
    expect(urls).toContain(`${ORIGIN}/he/team/anat-levi`);
    expect(urls).toContain(`${ORIGIN}/he/accessibility`);
    expect(urls.filter((u) => u.includes('/he')).length).toBe(PAGES);
  });

  it('gives every entry en, he and x-default alternates that include itself', () => {
    for (const e of entries) {
      const langs = e.alternates?.languages as Record<string, string> | undefined;
      expect(Object.keys(langs ?? {}).sort(), e.url).toEqual(['en', 'he', 'x-default']);
      expect(Object.values(langs!)).toContain(e.url);
      expect(langs!['x-default']).toBe(langs!.en);
      expect(langs!.he).toBe(
        langs!.en === `${ORIGIN}/` ? `${ORIGIN}/he` : langs!.en!.replace(ORIGIN, `${ORIGIN}/he`),
      );
    }
  });

  it('carries priority and lastModified on every entry', () => {
    for (const e of entries) {
      expect(typeof e.priority).toBe('number');
      expect(String(e.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('robotsConfig', () => {
  const robots = robotsConfig(ORIGIN);
  const rules = (Array.isArray(robots.rules) ? robots.rules : [robots.rules]) as Array<{
    userAgent: string;
    allow: string;
  }>;

  it('allows everything for everyone and names the welcomed crawlers explicitly', () => {
    expect(rules[0]).toEqual({ userAgent: '*', allow: '/' });
    const named = rules.slice(1).map((r) => r.userAgent);
    expect(named).toEqual([...WELCOMED_CRAWLERS]);
    for (const ua of [
      'GPTBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'ClaudeBot',
      'Claude-SearchBot',
      'Claude-User',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'Applebot-Extended',
      'Bingbot',
    ]) {
      expect(named).toContain(ua);
    }
    expect(rules.every((r) => r.allow === '/')).toBe(true);
  });

  it('points at the sitemap and has none of the campaign sign-in rules', () => {
    expect(robots.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(JSON.stringify(robots)).not.toMatch(/disallow|entry=/i);
  });
});
