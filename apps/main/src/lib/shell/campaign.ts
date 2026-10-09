import type { Locale } from '@dpl/core';
import { campaignIsBilingual } from '@dpl/i18n';

/**
 * Links from the law firm's site into the citizenship campaign app (eligibility check, client portal sign-in).
 * The campaign has its own domain; Hebrew pages go to its /he edition. `source=main-site` tells it where the visitor came from.
 */
export type CampaignEntry = 'eligibility' | 'sign-in';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const DEFAULT_BASE = process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com';

// NEXT_PUBLIC_* values are inlined at build time, so the variable has to be spelled out here.
const DEFAULT_BILINGUAL = campaignIsBilingual(process.env.NEXT_PUBLIC_CAMPAIGN_LOCALES);

export function campaignUrl(locale: Locale, entry: CampaignEntry, base: string = DEFAULT_BASE, bilingual: boolean = DEFAULT_BILINGUAL): string {
  // The campaign's public pages are English only unless NEXT_PUBLIC_CAMPAIGN_LOCALES says otherwise (@dpl/i18n
  // campaign-locales): then every link goes to its English edition, which is the only one there is.
  if (!bilingual) return `${base.replace(/\/$/, '')}/${entry}?source=main-site`;
  // an English page passes its language on: a visitor in Israel who chose English here must not be sent to the Hebrew edition
  return `${base.replace(/\/$/, '')}${locale === 'he' ? '/he' : ''}/${entry}?source=main-site${locale === 'he' ? '' : '&lang=en'}`;
}
