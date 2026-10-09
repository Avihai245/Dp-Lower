import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];



const isDev = process.env.NODE_ENV !== 'production';
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();
/**
 * Content-Security-Policy. Next.js needs inline scripts for hydration, so script-src allows 'unsafe-inline' (all content is
 * escaped by React and there is no user-supplied HTML). Third parties are limited to what the pages really use: YouTube
 * (privacy-enhanced embeds + poster), Cloudflare Turnstile and Supabase (API, Storage uploads, Realtime).
 */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com",
    "font-src 'self' data:",
    `connect-src 'self' https://challenges.cloudflare.com${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, 'ws')}` : ''}${isDev ? ' ws: http:' : ''}`,
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com',
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    // only when the site is really served over https (a local `next start` over http must keep working)
    ...(!isDev && (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://') ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // crawlers that do not run JavaScript (search and AI answer engines, link previews) get blocking <head> metadata
  htmlLimitedBots: /Googlebot|Google-InspectionTool|Bingbot|DuckDuckBot|Applebot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp/i,
  transpilePackages: ['@dpl/core', '@dpl/ui', '@dpl/i18n', '@dpl/db', '@dpl/emails'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }],
  },
  webpack(config) {
    // a font file imported from code (src/lib/font-preload.ts, only for its URL) is emitted exactly like the ones the CSS
    // names: same folder, same content hash, so the preload is the request the stylesheet makes anyway
    config.module.rules.push({
      test: /\.woff2$/,
      issuer: { not: [/\.(css|scss|sass)$/] },
      type: 'asset/resource',
      generator: { filename: 'static/media/[name].[hash:8][ext]' },
    });
    return config;
  },
  async headers() {
    return [{ source: '/:path*', headers: [...securityHeaders, { key: 'Content-Security-Policy', value: contentSecurityPolicy() }] }];
  },
  async redirects() {
    return [
      // the campaign path used in the email footers
      { source: '/ger-aus', destination: '/', permanent: true },
      { source: '/ger-aus/', destination: '/', permanent: true },
      { source: '/he/ger-aus', destination: '/he', permanent: true },
    ];
  },
};

export default withNextIntl(config);
