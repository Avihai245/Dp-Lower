import { parseUtm } from './lead-form';

/**
 * Where an enquiry came from. The visitor lands on a page with ?utm_source=... and may send the form three pages later,
 * so the first-touch parameters are kept for the browser session (sessionStorage: gone when the tab closes) and sent
 * with every form. No dependencies on purpose: this runs in the browser bundle, which must not pull in zod.
 */

const KEY = 'dpl-attribution';

interface Stored {
  utm: Record<string, string>;
  /** host of the external site that sent the visitor, if any */
  referrer: string | null;
}

/** Host of `referrer` when it is another site; null for no referrer, the site itself or something unparseable. */
export function externalReferrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host;
    return host && host !== ownHost ? host.slice(0, 80) : null;
  } catch {
    return null;
  }
}

function read(store: Pick<Storage, 'getItem'>): Stored {
  try {
    const raw = store.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      return {
        utm: v.utm && typeof v.utm === 'object' ? v.utm : {},
        referrer: typeof v.referrer === 'string' ? v.referrer : null,
      };
    }
  } catch {
    // storage blocked or corrupted: behave as if nothing was stored
  }
  return { utm: {}, referrer: null };
}

/**
 * Call on every page view. The first view that carries campaign parameters or an external referrer is kept; later views
 * never overwrite it (first touch wins), and a visit with nothing to keep writes nothing.
 */
export function rememberFirstTouch(
  search: string,
  referrer: string,
  ownHost: string,
  store: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  try {
    if (store.getItem(KEY)) return;
    const utm = parseUtm(search);
    const ref = externalReferrerHost(referrer, ownHost);
    if (Object.keys(utm).length === 0 && !ref) return;
    store.setItem(KEY, JSON.stringify({ utm, referrer: ref } satisfies Stored));
  } catch {
    // private mode or blocked storage: the form falls back to the parameters of the current URL
  }
}

/**
 * The `utm` and `source` fields of a form submission: the first-touch parameters, unless the page being sent from carries
 * campaign parameters of its own (a newer click), which are used instead, as a whole: two touches are never mixed into
 * one. The source is a short label (utm_source, else the referring site, else "direct").
 */
export function attributionFor(
  search: string,
  store: Pick<Storage, 'getItem'>,
): { utm: Record<string, string>; source: string } {
  const stored = read(store);
  const current = parseUtm(search);
  const utm = Object.keys(current).length > 0 ? current : stored.utm;
  const keys = Object.keys(utm);
  const capped = keys.length > 12 ? Object.fromEntries(keys.slice(0, 12).map((k) => [k, utm[k]!])) : utm;
  return { utm: capped, source: (capped['utm_source'] || stored.referrer || 'direct').slice(0, 80) };
}

/** `attributionFor` for the page the visitor is on; safe when sessionStorage is unavailable. */
export function currentAttribution(): { utm: Record<string, string>; source: string } {
  try {
    return attributionFor(window.location.search, window.sessionStorage);
  } catch {
    return attributionFor(window.location.search, { getItem: () => null });
  }
}

const UTM_KEY = /^utm_[a-z0-9_]{1,30}$/;

/**
 * A link into the campaign app with the visitor's first-touch campaign parameters added, so that a lead who came from an
 * ad to the firm's site and went on to the eligibility check is still attributed to that ad (the campaign is another
 * domain: it can only learn it from the link). Links to anything else, and links that already carry utm_* of their own,
 * are returned unchanged.
 */
export function withCampaignParams(href: string, utm: Record<string, string>, campaignOrigin: string): string {
  try {
    const url = new URL(href);
    if (url.origin !== new URL(campaignOrigin).origin) return href;
    for (const key of url.searchParams.keys()) if (key.toLowerCase().startsWith('utm_')) return href;
    let added = 0;
    for (const [key, value] of Object.entries(utm)) {
      if (added >= 8 || !UTM_KEY.test(key) || !value) continue;
      url.searchParams.set(key, value.slice(0, 100));
      added++;
    }
    return added ? url.toString() : href;
  } catch {
    return href;
  }
}
