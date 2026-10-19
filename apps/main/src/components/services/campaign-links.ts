import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import { campaignIsBilingual } from '@dpl/i18n';

export type CampaignEntry = 'eligibility' | 'sign-in';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const campaignOrigin = (): string =>
  (process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com').replace(/\/$/, '');

/**
 * Links from a service page to the eligibility check (this site's own /apply) and to the client sign-in (the portal app, euro-passports.com).
 * Hebrew pages go to the campaign's /he edition; `source=main-site` tells the campaign where the visitor came from (it
 * keeps it for lead attribution). Same URLs as the shell's `campaignUrl` helper: swap this for that import when merging.
 */
export function campaignHref(locale: Locale, entry: CampaignEntry): string {
  const bilingual = campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES);
  // the eligibility check is this site's own /apply (it moved here from the campaign app): an internal address
  if (entry === 'eligibility') return `${bilingual && locale !== DEFAULT_LOCALE ? `/${locale}` : ''}/apply/eligibility?source=main-site`;
  // the campaign's public pages are English only unless NEXT_PUBLIC_CAMPAIGN_LOCALES says otherwise
  if (!campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES)) return `${campaignOrigin()}/${entry}?source=main-site`;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${campaignOrigin()}${prefix}/${entry}?source=main-site${locale === DEFAULT_LOCALE ? '&lang=en' : ''}`;
}
