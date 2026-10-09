import { LOCALES, type Locale } from '@dpl/core';

/**
 * Which languages the campaign's public pages (landing page, eligibility check, booking, offer, client portal sign-in)
 * are published in. Today they are English only; the Hebrew edition is built and tested but switched off, so that a
 * bilingual landing page can be turned on later with one setting:
 *
 *   NEXT_PUBLIC_CAMPAIGN_LOCALES=en        English only (the default)
 *   NEXT_PUBLIC_CAMPAIGN_LOCALES=en,he     both languages: the Hebrew edition under /he, the language switch,
 *                                          hreflang alternates, and the Hebrew start for visitors in Israel
 *
 * The value is read where it is used (the middleware, the header, the metadata, the links from the firm's website), and
 * the firm's website reads the same setting so that its links point at an edition that exists. Staff keep their own
 * Hebrew interface in /he/admin whatever this says.
 */
export function campaignLocales(raw: string | null | undefined): Locale[] {
  const wanted = (raw ?? '').split(',').map((part) => part.trim().toLowerCase());
  const list = LOCALES.filter((locale) => wanted.includes(locale));
  return list.includes('en') ? list : ['en', ...list];
}

/** true when the campaign's public pages exist in Hebrew as well as English. */
export const campaignIsBilingual = (raw: string | null | undefined): boolean => campaignLocales(raw).includes('he');
