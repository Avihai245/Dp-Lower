import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/crawl';
import { SITE_URL } from '@/lib/seo';

/** /sitemap.xml: every public page in English and Hebrew with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(SITE_URL);
}
