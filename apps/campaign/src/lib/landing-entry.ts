/**
 * Platform deep links into the campaign system. Other sites (the firm's corporate site, future campaigns) send
 * visitors to `/?entry=eligibility|signin|portal&source=<origin>` so they never see this landing page.
 * (From the prototype's `ENTRY` map: signin and portal both go to the portal when the visitor is already known.)
 */
export type EntryTarget = '/eligibility' | '/sign-in' | '/portal';

const normalise = (entry: string | null | undefined): string => (entry ?? '').trim().toLowerCase();

/** True for the entries whose destination depends on whether a session exists. */
export function entryNeedsSession(entry: string | null | undefined): boolean {
  const e = normalise(entry);
  return e === 'signin' || e === 'portal';
}

/** Unprefixed destination for a deep link, or null when `entry` is missing or unknown (the landing page renders). */
export function entryTarget(entry: string | null | undefined, hasSession: boolean): EntryTarget | null {
  switch (normalise(entry)) {
    case 'eligibility':
      return '/eligibility';
    case 'signin':
    case 'portal':
      return hasSession ? '/portal' : '/sign-in';
    default:
      return null;
  }
}

/** Next hands over `string | string[] | undefined` for a query parameter; the first value wins. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The query string of the incoming request as URLSearchParams (repeated parameters keep every value). */
export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((item) => out.append(k, item));
    else if (v !== undefined) out.append(k, v);
  }
  return out;
}
