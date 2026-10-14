/**
 * Platform deep links: other sites (the firm's corporate site, future campaigns) send visitors to
 * `/?entry=eligibility|signin|portal&source=<origin>`. This app has no landing page of its own any more (the
 * eligibility funnel and the rest of the landing content live on the firm's own site, under /apply): a bare visit
 * (no `entry` at all — someone opening the portal's own domain directly) shows the portal itself, sign-in or
 * /portal depending on whether the visitor is already known, exactly like an explicit `entry=signin`/`entry=portal`
 * deep link. Only a deep link that explicitly names something else — `entry=eligibility` included — leaves for the
 * firm's site, since that is what an ad or a corporate-site link asking for the funnel means.
 * (From the prototype's `ENTRY` map: signin and portal both go to the portal when the visitor is already known.)
 */
export type EntryTarget = { kind: 'internal'; path: '/sign-in' | '/portal' } | { kind: 'external'; path: '/apply' };

const normalise = (entry: string | null | undefined): string => (entry ?? '').trim().toLowerCase();

/** True for the entries whose destination depends on whether a session exists. */
export function entryNeedsSession(entry: string | null | undefined): boolean {
  const e = normalise(entry);
  return e === 'signin' || e === 'portal' || e === '';
}

/** Where a deep link (or a bare visit with no `entry` at all) should end up. */
export function entryTarget(entry: string | null | undefined, hasSession: boolean): EntryTarget {
  switch (normalise(entry)) {
    case 'signin':
    case 'portal':
    case '':
      return { kind: 'internal', path: hasSession ? '/portal' : '/sign-in' };
    default:
      return { kind: 'external', path: '/apply' };
  }
}
