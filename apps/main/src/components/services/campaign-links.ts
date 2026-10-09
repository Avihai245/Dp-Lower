import { DEFAULT_LOCALE, type Locale } from '@dpl/core';
import { campaignIsBilingual } from '@dpl/i18n';

export type CampaignEntry = 'eligibility' | 'sign-in';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const campaignOrigin = (): string =>
  (process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com').replace(/\/$/, '');

/**
 * Links from a service page into the campaign app (euro-passports.com): its eligibility check and its client sign-in.
 * Hebrew pages go to the campaign's /he edition; `source=main-site` tells the campaign where the visitor came from (it
 * keeps it for lead attribution). Same URLs as the shell's `campaignUrl` helper: swap this for that import when merging.
 */
export function campaignHref(locale: Locale, entry: CampaignEntry): string {
  // the campaign's public pages are English only unless NEXT_PUBLIC_CAMPAIGN_LOCALES says otherwise
  if (!campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES)) return `${campaignOrigin()}/${entry}?source=main-site`;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${campaignOrigin()}${prefix}/${entry}?source=main-site${locale === DEFAULT_LOCALE ? '&lang=en' : ''}`;
}
