import type { MetadataRoute } from 'next';
import { absoluteUrl, alternates } from '@dpl/i18n';
import { LOCALES } from '@dpl/core';
import { isBilingual } from '@/lib/bilingual';
import { SITE_URL } from '@/lib/seo';

/** Date of the content the pages were built from (a lastmod that is "now" teaches crawlers to ignore it); bump it when they change. */
const CONTENT_UPDATED = '2026-10-09';

const PAGES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/privacy', priority: 0.3 },
];

/** The public pages of the campaign site, in both languages, each with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority }) =>
    LOCALES.filter((locale) => locale === 'en' || isBilingual()).map((locale) => ({
      url: absoluteUrl(SITE_URL, locale, path),
      lastModified: CONTENT_UPDATED,
      priority,
      ...(isBilingual() ? { alternates: { languages: alternates(SITE_URL, path) } } : {}),
    })),
  );
}
