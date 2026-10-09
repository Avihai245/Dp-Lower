import type { MetadataRoute } from 'next';
import { robotsConfig } from '@/lib/crawl';
import { SITE_URL } from '@/lib/seo';

/** /robots.txt: open to everyone, with search and AI crawlers named explicitly. */
export default function robots(): MetadataRoute.Robots {
  return robotsConfig(SITE_URL);
}
