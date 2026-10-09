import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { LANG_COOKIE, LANG_COOKIE_OPTIONS, chosenLanguage, countryOf, shouldGoHebrew } from '@dpl/i18n';
import { routing } from './i18n/routing';
import { isRootFile, missingPageLocale } from './lib/known-routes';
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
  if (target) {
    const res = NextResponse.redirect(new URL(target, req.url), 301);
    // the old ?lang= was a statement of the language wanted: keep it as the choice, so the country default does not undo it
    const asked = chosenLanguage({ cookie: null, langParam: req.nextUrl.searchParams.get('lang') });
    if (asked) res.cookies.set(LANG_COOKIE, asked, LANG_COOKIE_OPTIONS);
    return res;
  }
  // a file that exists at the root (the icons, robots.txt, sitemap.xml, llms.txt) is served as it is
  if (isRootFile(req.nextUrl.pathname)) return NextResponse.next();
  // English has no prefix: /en/about is /about (a permanent redirect, so that search engines keep one address per page)
  if (/^\/en(\/|$)/.test(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.pathname.replace(/^\/en/, '') || '/';
    return NextResponse.redirect(url, 308);
  }
  // Not a page of the site: a server-rendered 404 in the visitor's language (a page calling notFound() would reach the
  // browser as an empty shell). The 404 page itself is an ordinary page that this rewrite points at.
  const missing = missingPageLocale(req.nextUrl.pathname);
  if (missing) return NextResponse.rewrite(new URL(`/${missing}/page-not-found`, req.url), { status: 404 });
  // A visitor in Israel (or who chose Hebrew before) who opens an English address is taken to the Hebrew edition; see
  // @dpl/i18n language-choice for the rules (an explicit choice wins, crawlers are never redirected).
  const { pathname, searchParams } = req.nextUrl;
  const langParam = searchParams.get('lang');
  const request = {
    pathname,
    method: req.method,
    accept: req.headers.get('accept'),
    userAgent: req.headers.get('user-agent'),
    country: countryOf(req.headers),
    cookie: req.cookies.get(LANG_COOKIE)?.value ?? null,
    langParam,
  };
  if (shouldGoHebrew(request)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === '/' ? '/he' : `/he${pathname}`;
    url.searchParams.delete('lang');
    const res = NextResponse.redirect(url, 307);
    // only a stated preference is remembered, not the country the visit happens to come from
    if (langParam === 'he') res.cookies.set(LANG_COOKIE, 'he', LANG_COOKIE_OPTIONS);
    return res;
  }
  const res = intl(req);
  // ?lang=en on an English address is a choice too (the campaign passes it on); remember it so the next page agrees
  if (chosenLanguage({ cookie: null, langParam }) === 'en' && req.cookies.get(LANG_COOKIE)?.value !== 'en') res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTIONS);
  return res;
}

// Not the API, the build output and files in folders (/images/logo.webp). A single segment with a dot (/favicon.ico,
// /wp-login.php) is included: it is either a file of ROOT_FILES or a 404, and must not reach the router as a "language".
export const config = { matcher: ['/((?!api|_next|_vercel|.*/.*\\..*).*)'] };
