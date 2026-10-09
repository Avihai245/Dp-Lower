import type { Locale } from '@dpl/core';
import enSeo from '../../messages/en/seo.json';
import heSeo from '../../messages/he/seo.json';
import { buildLlmsFullTxt, buildLlmsTxt } from './llms';
import { SITE_URL } from './seo';

const STRINGS = { en: enSeo.llms, he: heSeo.llms } as const;

const campaignOrigin = () =>
  (process.env.NEXT_PUBLIC_CAMPAIGN_URL ?? 'https://euro-passports.com').replace(/\/$/, '');

/** The HTTP response of /llms.txt, /llms-full.txt and their /he twins: plain text, cacheable by browsers, the CDN and crawlers. */
export function llmsResponse(locale: Locale, full: boolean): Response {
  const options = { locale, origin: SITE_URL, campaignUrl: campaignOrigin(), strings: STRINGS[locale] };
  return new Response(full ? buildLlmsFullTxt(options) : buildLlmsTxt(options), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
