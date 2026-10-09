/**
 * First-touch lead attribution. The middleware records where a visitor came from in two cookies that the lead API
 * (`POST /api/leads`) reads when the lead is created:
 *
 *   dpl_src  the `source` query parameter (max 80 chars). Defaults to "campaign-ger-aus"; "direct" when the visit
 *            arrived through a platform deep link (`?entry=...`) without a `source`.
 *   dpl_utm  URL-encoded JSON object of the `utm_*` query parameters.
 *
 * A third cookie answers a different question: where did the CURRENT visit come from, so that "Back to the site" returns
 * there?
 *
 *   dpl_from the `source` of the latest deep link (`?entry=...&source=main-site`), overwritten by every deep link
 *            ("direct" when the link has an entry but no source). Not attribution: the first touch above never changes.
 *
 * The server reads them back with `decodeAttribution` below (which also validates them, as cookies are
 * client-controlled). Cookies last 30 days, path=/, SameSite=Lax. Only the first touch is recorded: once either cookie
 * exists nothing is overwritten. Pure functions so the rules are unit-testable; src/middleware.ts sets the cookies.
 */

export const SRC_COOKIE = 'dpl_src';
export const UTM_COOKIE = 'dpl_utm';
export const FROM_COOKIE = 'dpl_from';
export const DEFAULT_SOURCE = 'campaign-ger-aus';
export const DIRECT_SOURCE = 'direct';
export const SOURCE_MAX_LENGTH = 80;
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Caps that keep the utm cookie far below the 4 KB browser limit. */
const UTM_MAX_KEYS = 8;
const UTM_VALUE_MAX_LENGTH = 100;
const UTM_KEY = /^utm_[a-z0-9_]{1,30}$/;

export interface Attribution {
  source: string;
  /** null when the URL carries no utm_* parameter */
  utm: Record<string, string> | null;
}

/** Trims, drops control characters and cuts to `max`. Returns null when nothing is left. */
function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const v = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max)
    .trim();
  return v === '' ? null : v;
}

/** What the URL says about the visit, or null when it says nothing (no source, no utm_*, no entry). */
export function parseAttribution(search: string | URLSearchParams): Attribution | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;

  const source = clean(params.get('source'), SOURCE_MAX_LENGTH);
  const hasEntry = clean(params.get('entry'), 40) !== null;

  const utm: Record<string, string> = {};
  for (const [rawKey, rawValue] of params) {
    const key = rawKey.toLowerCase();
    if (!UTM_KEY.test(key) || key in utm || Object.keys(utm).length >= UTM_MAX_KEYS) continue;
    const value = clean(rawValue, UTM_VALUE_MAX_LENGTH);
    if (value !== null) utm[key] = value;
  }
  const hasUtm = Object.keys(utm).length > 0;

  if (!source && !hasEntry && !hasUtm) return null;
  return {
    source: source ?? (hasEntry ? DIRECT_SOURCE : DEFAULT_SOURCE),
    utm: hasUtm ? utm : null,
  };
}

export interface AttributionCookie {
  name: string;
  value: string;
}

/** The cookies to set for this attribution (the platform URL-encodes the values when it writes the header). */
export function attributionCookieList(attribution: Attribution): AttributionCookie[] {
  const out: AttributionCookie[] = [{ name: SRC_COOKIE, value: attribution.source }];
  if (attribution.utm) out.push({ name: UTM_COOKIE, value: JSON.stringify(attribution.utm) });
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The other end, for the server (the lead API): turns the two cookie values the browser sends back into an
 * Attribution. Cookies are client-controlled input, so everything is decoded defensively and capped again; anything
 * malformed falls back to the default source / no utm. The result satisfies `source` (max 80) and the `utm` record
 * (<= 12 keys, keys <= 40, values <= 300) of the lead schema in @dpl/core.
 */
export function decodeAttribution(
  src: string | null | undefined,
  utm: string | null | undefined,
): Attribution {
  const source = (src ? clean(safeDecode(src), SOURCE_MAX_LENGTH) : null) ?? DEFAULT_SOURCE;

  let decodedUtm: Record<string, string> | null = null;
  if (utm) {
    try {
      const parsed: unknown = JSON.parse(safeDecode(utm));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [rawKey, rawValue] of Object.entries(parsed)) {
          const key = rawKey.toLowerCase();
          if (!UTM_KEY.test(key) || key in out || Object.keys(out).length >= UTM_MAX_KEYS) continue;
          const value = typeof rawValue === 'string' ? clean(rawValue, UTM_VALUE_MAX_LENGTH) : null;
          if (value !== null) out[key] = value;
        }
        if (Object.keys(out).length > 0) decodedUtm = out;
      }
    } catch {
      /* not JSON: ignore the cookie */
    }
  }
  return { source, utm: decodedUtm };
}

/**
 * The cookie that says where this visit came from, or null when the URL names no origin (no `source`, no `entry`). Unlike
 * the first-touch cookies it is written on every deep link, so a visitor who first came from an advertisement and now
 * arrives from the firm's website is sent back to the website.
 */
export function returnCookie(search: string | URLSearchParams): AttributionCookie | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const source = clean(params.get('source'), SOURCE_MAX_LENGTH);
  const hasEntry = clean(params.get('entry'), 40) !== null;
  if (!source && !hasEntry) return null;
  return { name: FROM_COOKIE, value: source ?? DIRECT_SOURCE };
}

/**
 * Middleware entry point: the cookies to set for a visit to a URL with these query parameters, given which cookies the
 * browser already holds. Empty when the URL carries no attribution or a first touch was already recorded.
 */
export function firstTouchCookies(
  search: string | URLSearchParams,
  has: (cookieName: string) => boolean,
): AttributionCookie[] {
  if (has(SRC_COOKIE) || has(UTM_COOKIE)) return [];
  const attribution = parseAttribution(search);
  return attribution ? attributionCookieList(attribution) : [];
}
