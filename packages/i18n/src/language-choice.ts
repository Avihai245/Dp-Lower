import type { Locale } from '@dpl/core';

/**
 * The language a visitor starts in. English lives at the root and Hebrew under /he, and the URLs stay deterministic (so
 * that search engines and shared links always get the same page); what changes is where a visitor WITHOUT a stated
 * preference who opens an English address is sent:
 *
 *   1. an explicit choice wins: the language switch writes the `dpl_lang` cookie, and a link may say `?lang=en|he`
 *      (the firm's site passes the language the visitor was reading on to the campaign this way);
 *   2. otherwise a visitor in Israel (the platform's country header) is taken to the Hebrew edition;
 *   3. anyone else stays on the English page they asked for.
 *
 * Crawlers and link previews are never redirected: they must see the page the address names. Only page navigations (GET
 * or HEAD asking for HTML) are considered, and an address that is already /he/... is never redirected away.
 */
export const LANG_COOKIE = 'dpl_lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const BOT = /bot|crawl|spider|slurp|preview|fetch|facebookexternalhit|embedly|whatsapp|telegram|lighthouse|pingdom|monitor|curl|wget|python-requests|headless/i;

const asLocale = (value: string | null | undefined): Locale | null => (value === 'en' || value === 'he' ? value : null);

export interface LanguageRequest {
  /** the path as requested, with no locale prefix handling done yet */
  pathname: string;
  method: string;
  accept: string | null;
  userAgent: string | null;
  /** ISO country code from the platform (x-vercel-ip-country, cf-ipcountry) */
  country: string | null;
  /** value of the dpl_lang cookie */
  cookie: string | null;
  /** value of the ?lang= query parameter */
  langParam: string | null;
}

/** The language an explicit choice names (query parameter first, then the cookie), or null. */
export function chosenLanguage(req: Pick<LanguageRequest, 'cookie' | 'langParam'>): Locale | null {
  return asLocale(req.langParam) ?? asLocale(req.cookie);
}

/** true when this visitor should be sent from the English address to the Hebrew edition. */
export function shouldGoHebrew(req: LanguageRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!(req.accept ?? '').includes('text/html')) return false;
  if (req.userAgent && BOT.test(req.userAgent)) return false;
  if (req.pathname === '/he' || req.pathname.startsWith('/he/')) return false;
  const chosen = chosenLanguage(req);
  if (chosen) return chosen === 'he';
  return (req.country ?? '').toUpperCase() === 'IL';
}

/** The country of a request from the headers the hosting platforms add; null when none is present. */
export function countryOf(headers: { get(name: string): string | null }): string | null {
  const code = headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry');
  return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;
}

/** The `Set-Cookie` attributes of the language cookie, for the server side (middleware) when ?lang= is used. */
export const LANG_COOKIE_OPTIONS = { maxAge: ONE_YEAR_SECONDS, path: '/', sameSite: 'lax' as const };

/** Browser side: remember the language the visitor picked with the switch. Never throws (storage may be blocked). */
export function rememberLanguage(locale: Locale): void {
  try {
    document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  } catch {
    // cookies blocked: the switch still works, the choice is just not remembered
  }
}
