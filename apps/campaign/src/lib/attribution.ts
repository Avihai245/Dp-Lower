/**
 * First-touch lead attribution. The landing page records where a visitor came from in two cookies that the lead API
 * (`POST /api/leads`) reads when the lead is created:
 *
 *   dpl_src  the `source` query parameter (max 80 chars). Defaults to "campaign-ger-aus"; "direct" when the visit
 *            arrived through a platform deep link (`?entry=...`) without a `source`.
 *   dpl_utm  URL-encoded JSON object of the `utm_*` query parameters.
 *
 * Both values are written with encodeURIComponent; the server reads them back with `decodeAttribution` below (which also
 * validates them, as cookies are client-controlled). Cookies last 30 days, path=/, SameSite=Lax. Only the first touch is
 * recorded: once either cookie exists nothing is overwritten.
 * Pure functions so the rules are unit-testable; `SourceCapture` does the actual `document.cookie` writes.
 */

export const SRC_COOKIE = 'dpl_src';
export const UTM_COOKIE = 'dpl_utm';
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

/** Value of one cookie in a `document.cookie` string, or null. */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function cookie(name: string, value: string, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The `Set-Cookie`-style strings to assign to `document.cookie` for this attribution. */
export function attributionCookies(attribution: Attribution, secure: boolean): string[] {
  const out = [cookie(SRC_COOKIE, attribution.source, secure)];
  if (attribution.utm) out.push(cookie(UTM_COOKIE, JSON.stringify(attribution.utm), secure));
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
 * Everything `SourceCapture` needs in one call: the cookies to write for a visit to `search`, given the cookies the
 * browser already holds. Empty when the URL carries no attribution or a first touch was already recorded.
 */
export function cookiesToWrite(search: string, existingCookies: string, secure: boolean): string[] {
  if (readCookie(existingCookies, SRC_COOKIE) !== null || readCookie(existingCookies, UTM_COOKIE) !== null)
    return [];
  const attribution = parseAttribution(search);
  return attribution ? attributionCookies(attribution, secure) : [];
}
