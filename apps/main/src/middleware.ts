import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

const STATIC_PAGES = new Set(['about', 'services', 'team', 'testimonials', 'insights', 'media', 'contact', 'privacy', 'terms', 'accessibility']);

/**
 * The prototype addressed pages as ?p=service/german-citizenship&lang=he. Those URLs are in the old sitemap and
 * llms.txt and may have been shared, so they 301 to the clean paths (/services/german-citizenship, /he/...).
 */
function legacyTarget(req: NextRequest): string | null {
  const { searchParams, pathname } = req.nextUrl;
  const p = searchParams.get('p');
  const lang = searchParams.get('lang');
  if (pathname !== '/' || (!p && !lang)) return null;

  let path = '/';
  if (p) {
    const [kind, ...rest] = p.split('/');
    const slug = rest.join('/');
    if (kind && STATIC_PAGES.has(kind) && !slug) path = `/${kind}`;
    else if (kind === 'service' && slug) path = `/services/${slug}`;
    else if (kind === 'article' && slug) path = `/insights/${slug}`;
    else if (kind === 'attorney' && slug) path = `/team/${slug}`;
  }
  return lang === 'he' ? (path === '/' ? '/he' : `/he${path}`) : path;
}

export default function middleware(req: NextRequest) {
  const target = legacyTarget(req);
  if (target) return NextResponse.redirect(new URL(target, req.url), 301);
  return intl(req);
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
