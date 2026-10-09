import { stripBidiControls, type Locale } from '@dpl/core';
import { buildLlmsFullTxt, buildLlmsTxt } from './llms';
import { SITE_URL } from './seo';

const mainSite = () => (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il').replace(/\/$/, '');

/** The HTTP response of /llms.txt, /llms-full.txt and their /he twins: plain text, cacheable by browsers, the CDN and crawlers. */
export function llmsResponse(locale: Locale, full: boolean): Response {
  const options = { locale, origin: SITE_URL, mainSite: mainSite() };
  // a text for machines: without the invisible direction marks the Hebrew pages carry
  return new Response(stripBidiControls(full ? buildLlmsFullTxt(options) : buildLlmsTxt(options)), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
