import { DEFAULT_LOCALE, LOCALES, type Locale } from '@dpl/core';

/** English lives at the root, Hebrew under /he. `path` starts with "/" ("/" for home). */
export function localizedPath(locale: Locale, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return p;
  return p === '/' ? '/he' : `/he${p}`;
}

export function absoluteUrl(origin: string, locale: Locale, path: string): string {
  const base = origin.replace(/\/$/, '');
  const p = localizedPath(locale, path);
  return p === '/' ? `${base}/` : `${base}${p}`;
}

/** hreflang alternates for one page, including x-default. */
export function alternates(origin: string, path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = absoluteUrl(origin, l, path);
  out['x-default'] = absoluteUrl(origin, DEFAULT_LOCALE, path);
  return out;
}

/** Splits "/he/services/x" into the locale and the unprefixed path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === '/he' || pathname.startsWith('/he/')) {
    return { locale: 'he', path: pathname.slice(3) || '/' };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || '/' };
}
