import type { Locale } from '@dpl/core';

/**
 * Links from the law firm's site into the citizenship campaign app (eligibility check, client portal sign-in).
 * The campaign has its own domain; Hebrew pages go to its /he edition. `source=main-site` tells it where the visitor came from.
 */
export type CampaignEntry = 'eligibility' | 'sign-in';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const DEFAULT_BASE = process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com';

export function campaignUrl(locale: Locale, entry: CampaignEntry, base: string = DEFAULT_BASE): string {
  return `${base.replace(/\/$/, '')}${locale === 'he' ? '/he' : ''}/${entry}?source=main-site`;
}
