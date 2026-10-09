/**
 * Platform deep links into the campaign system. Other sites (the firm's corporate site, future campaigns) send
 * visitors to `/?entry=eligibility|signin|portal&source=<origin>` so they never see this landing page. The middleware
 * performs the redirect (so the landing page itself stays static) and records the origin of the visit.
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
