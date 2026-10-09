import { ARTICLE_SLUGS, SERVICE_SLUGS, TEAM_SLUGS } from '@dpl/i18n/slugs';

/**
 * The URLs the site answers, so the edge middleware can answer every other URL with a real, server-rendered 404 page.
 * (A page that calls `notFound()` is sent to the browser as an empty shell and drawn there: no content without scripts.)
 * Imported by the middleware, so it must stay small: no content bundles, no React.
 *
 * known-routes.test.ts compares these lists with the app directory, so a new page cannot be forgotten here.
 */

/** Pages without a slug, as unprefixed paths. */
export const STATIC_PATHS = [
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
] as const;

/** Folders whose pages take a slug: /services/german-citizenship, /team/michael-decker, /insights/... */
export const SLUG_COLLECTIONS: Record<string, readonly string[]> = {
  services: SERVICE_SLUGS,
  team: TEAM_SLUGS,
  insights: ARTICLE_SLUGS,
};

const KNOWN = new Set<string>([
  ...STATIC_PATHS,
  ...Object.entries(SLUG_COLLECTIONS).flatMap(([folder, slugs]) => slugs.map((slug) => `/${folder}/${slug}`)),
]);

/** True for a page of the site; `path` is unprefixed ("/services/german-citizenship"), a trailing slash is ignored. */
export function isKnownPath(path: string): boolean {
  return KNOWN.has(path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);
}

/**
 * The language to render the 404 page in when `pathname` (as requested, with or without /he) is not a page of the site;
 * null when it is one, and the router should carry on. The explicit English prefix (/en/about) is a known page too: the
 * locale middleware redirects it to the clean URL.
 */
export function missingPageLocale(pathname: string): 'en' | 'he' | null {
  const m = /^\/(en|he)(\/.*)?$/.exec(pathname);
  const locale = m?.[1] === 'he' ? 'he' : 'en';
  const path = m ? (m[2] ?? '/') : pathname;
  return isKnownPath(path) ? null : locale;
}
