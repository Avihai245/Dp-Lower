import type { MetadataRoute } from 'next';

/**
 * This app has no public content of its own any more: it is the client sign-in and portal only (the eligibility
 * funnel and the rest of the landing content moved to the firm's own site, under /apply, which has its own sitemap).
 * An empty sitemap is correct here, not an oversight.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
