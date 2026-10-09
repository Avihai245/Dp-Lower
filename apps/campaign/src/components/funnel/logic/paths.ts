import { DEFAULT_LOCALE, isLocale, type Locale } from '@dpl/core';

/** `/he/portal` -> `/portal`, `/he?x=1` -> `/?x=1`; paths of the default language are returned unchanged. */
export function stripLocale(path: string): string {
  const m = /^\/(he)(?=\/|\?|#|$)/.exec(path);
  if (!m) return path;
  const rest = path.slice(m[0].length);
  return rest === '' || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest;
}

/** The language prefix a path already carries, if any. */
export function localeOfPath(path: string): Locale | null {
  const m = /^\/([a-z]{2})(?=\/|\?|#|$)/.exec(path);
  return m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE ? m[1] : null;
}

/**
 * Puts the language prefix in front of an app path (English has none: localePrefix 'as-needed'). A path that already
 * carries a prefix, e.g. the `/he/portal` the middleware puts into `?next=`, is left alone.
 */
export function localizePath(path: string, locale: Locale): string {
  if (localeOfPath(path)) return path;
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
