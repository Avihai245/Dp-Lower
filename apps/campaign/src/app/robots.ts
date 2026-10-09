import type { MetadataRoute } from 'next';
import { isBilingual } from '@/lib/bilingual';
import { SITE_URL } from '@/lib/seo';

const PRIVATE = ['/api/', '/portal', '/admin', '/sign-in', '/create-password', '/go/', '/auth/', '/unsubscribe', '/eligibility', '/details', '/booking', '/offer'].flatMap((p) => (isBilingual() ? [p, `/he${p}`] : [p]));

const AI_AND_SEARCH_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
  'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot',
];

/** Open to search and AI answer engines; the funnel, portal, admin and auth pages are not for indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
