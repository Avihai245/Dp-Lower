import { LOCALES } from '@dpl/core';
import { absoluteUrl, alternates, ARTICLE_SLUGS, SERVICE_SLUGS, TEAM_SLUGS } from '@dpl/i18n';
import type { MetadataRoute } from 'next';
import { articleIsoDate } from './dates';

/**
 * Crawler policy and the sitemap. The data lives here (pure, origin as a parameter) so it can be unit tested;
 * app/sitemap.ts and app/robots.ts only hand it to Next.
 */

/**
 * Date of the content snapshot the pages were built from. Articles carry their own date; bump this when other content
 * changes (search engines only use lastmod when it is truthful, so it is not "now").
 */
export const CONTENT_UPDATED = '2026-10-09';

export interface SitePage {
  /** unprefixed path, "/" for home */
  path: string;
  /** the priorities of the design handoff's sitemap */
  priority: number;
  lastModified: string;
}

/** Every public page of the main site, once (the sitemap lists each in both languages). */
export function sitePages(): SitePage[] {
  const page = (path: string, priority: number, lastModified = CONTENT_UPDATED): SitePage => ({
    path,
    priority,
    lastModified,
  });
  return [
    page('/', 1),
    page('/about', 0.8),
    page('/services', 0.9),
    ...SERVICE_SLUGS.map((slug) => page(`/services/${slug}`, 0.9)),
    page('/team', 0.7),
    ...TEAM_SLUGS.map((slug) => page(`/team/${slug}`, 0.5)),
    page('/testimonials', 0.6),
    page('/insights', 0.7),
    ...ARTICLE_SLUGS.map((slug) => page(`/insights/${slug}`, 0.7, articleIsoDate(slug) ?? CONTENT_UPDATED)),
    page('/media', 0.5),
    page('/contact', 0.8),
    page('/privacy', 0.2),
    page('/terms', 0.2),
    page('/accessibility', 0.2),
  ];
}

/** One entry per page and language, each pointing at its alternates (en, he, x-default). The campaign app has its own sitemap. */
export function sitemapEntries(origin: string): MetadataRoute.Sitemap {
  return sitePages().flatMap((p) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(origin, locale, p.path),
      lastModified: p.lastModified,
      priority: p.priority,
      alternates: { languages: alternates(origin, p.path) },
    })),
  );
}

/** Search and AI answer engines the firm explicitly welcomes (same list as the design handoff's robots.txt). */
export const WELCOMED_CRAWLERS = [
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
] as const;

export function robotsConfig(origin: string): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...WELCOMED_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
