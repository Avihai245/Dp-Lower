import type { MetadataRoute } from 'next';
import { absoluteUrl, alternates } from '@dpl/i18n';
import { LOCALES } from '@dpl/core';
import { SITE_URL } from '@/lib/seo';

const PAGES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/privacy', priority: 0.3 },
];

/** The public pages of the campaign site, in both languages, each with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.flatMap(({ path, priority }) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(SITE_URL, locale, path),
      lastModified,
      priority,
      alternates: { languages: alternates(SITE_URL, path) },
    })),
  );
}
