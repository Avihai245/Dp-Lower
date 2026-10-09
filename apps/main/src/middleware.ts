import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { missingPageLocale } from './lib/known-routes';
import { legacyPath } from './lib/legacy-urls';

const intl = createMiddleware(routing);

/**
 * The prototype addressed pages as ?p=service/german-citizenship&lang=he. Those URLs are in the old sitemap and
 * llms.txt and may have been shared, so they 301 to the clean paths (/services/german-citizenship, /he/...).
 */
function legacyTarget(req: NextRequest): string | null {
  const { searchParams, pathname } = req.nextUrl;
  const p = searchParams.get('p');
  const lang = searchParams.get('lang');
  if (pathname !== '/' || (!p && !lang)) return null;

  const [kind, ...rest] = (p ?? '').split('/');
  const path = legacyPath(kind, rest.join('/') || undefined) ?? '/';
  const target = lang === 'he' ? (path === '/' ? '/he' : `/he${path}`) : path;
  // everything else on the old URL (utm_*, click ids) must survive the redirect: it is the campaign tracking
  const others = new URLSearchParams(searchParams);
  others.delete('p');
  others.delete('lang');
  const query = others.toString();
  return query ? `${target}?${query}` : target;
}

export default function middleware(req: NextRequest) {
  const target = legacyTarget(req);
  if (target) return NextResponse.redirect(new URL(target, req.url), 301);
  // Not a page of the site: a server-rendered 404 in the visitor's language (a page calling notFound() would reach the
  // browser as an empty shell). The 404 page itself is an ordinary page that this rewrite points at.
  const missing = missingPageLocale(req.nextUrl.pathname);
  if (missing) return NextResponse.rewrite(new URL(`/${missing}/page-not-found`, req.url), { status: 404 });
  return intl(req);
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
