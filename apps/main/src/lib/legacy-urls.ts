import { isKnownPath, STATIC_PATHS } from './known-routes';

/**
 * The design prototype addressed its pages as "?p=service/german-citizenship" and "#/service/german-citizenship". Those
 * addresses are in the old sitemap and llms.txt and may have been shared, so they still lead to the clean pages.
 * Pure and dependency-light: the middleware (for ?p=) and a client component (for #/) both use it.
 */

/** The prototype's page kinds that take a slug, and the folder each became. */
const FOLDER: Record<string, string> = { service: 'services', article: 'insights', attorney: 'team' };

const STATIC_KINDS = new Set(STATIC_PATHS.filter((p) => p !== '/').map((p) => p.slice(1)));

/** "service" + "german-citizenship" -> "/services/german-citizenship"; "about" -> "/about"; null for anything else (the redirect then goes home). */
export function legacyPath(kind: string | undefined, slug: string | undefined): string | null {
  if (!kind) return null;
  if (!slug) return STATIC_KINDS.has(kind) ? `/${kind}` : null;
  const folder = FOLDER[kind];
  return folder ? `/${folder}/${slug}` : null;
}

/**
 * Where "#/service/german-citizenship" (as typed after the site's address) should lead, in the visitor's language;
 * null when the hash is not one of the old addresses or names a page that does not exist (the visitor stays where they are).
 */
export function legacyHashTarget(hash: string, locale: string): string | null {
  const m = /^#\/([a-z-]+)(?:\/(.+))?$/.exec(hash);
  if (!m) return null;
  let slug = m[2];
  try {
    slug = slug ? decodeURIComponent(slug) : slug;
  } catch {
    return null;
  }
  const path = legacyPath(m[1], slug);
  if (!path || !isKnownPath(path)) return null;
  return locale === 'he' ? `/he${path}` : path;
}
