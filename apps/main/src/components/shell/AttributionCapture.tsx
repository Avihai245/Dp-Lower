'use client';

import { useEffect } from 'react';
import { currentAttribution, rememberFirstTouch, withCampaignParams } from '@/lib/shell/attribution';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const CAMPAIGN_ORIGIN = process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com';

/**
 * Remembers the campaign parameters and referrer of the first page view, for the enquiry forms (see
 * lib/shell/attribution.ts), and hands them on to the campaign app: a link into it (eligibility check, sign-in) gets the
 * first-touch utm_* parameters the moment it is used, so that the lead created there is attributed to the original ad.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      rememberFirstTouch(window.location.search, document.referrer, window.location.host, window.sessionStorage);
    } catch {
      // storage unavailable
    }
    const decorate = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const { utm } = currentAttribution();
      if (Object.keys(utm).length === 0) return;
      const href = withCampaignParams(link.href, utm, CAMPAIGN_ORIGIN);
      if (href !== link.href) link.href = href;
    };
    // click covers the keyboard too; the others cover "open in new tab" and "copy link"
    const events = ['click', 'auxclick', 'contextmenu'] as const;
    for (const name of events) document.addEventListener(name, decorate, true);
    return () => {
      for (const name of events) document.removeEventListener(name, decorate, true);
    };
  }, []);
  return null;
}
