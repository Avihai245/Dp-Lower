import { COOKIE_MAX_AGE_SECONDS, firstTouchCookies, returnCookie } from '@dpl/core';
import { refreshSession } from '@dpl/db/middleware';
import { LANG_COOKIE, LANG_COOKIE_OPTIONS, chosenLanguage, countryOf, shouldGoHebrew } from '@dpl/i18n';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { entryNeedsSession, entryTarget } from './lib/landing-entry';
import { isBilingual } from './lib/bilingual';
import { isRootFile, looksLikeRootFile } from './lib/root-files';

const intl = createMiddleware(routing);

/** Pages that need a signed-in user. /admin additionally checks the staff role in its layout; /verify and /two-step are the staff's two-step verification screens. */
const PROTECTED = ['/portal', '/admin', '/verify', '/two-step'];
/** Pages that read or refresh the session cookie. Everything else stays free of Supabase round trips. */
const SESSION_AWARE = [...PROTECTED, '/sign-in', '/create-password', '/auth'];

/** The English entry pages where the language default applies (see below). */
const LANGUAGE_ENTRY = ['/', '/sign-in'];

const stripLocale = (p: string) => p.replace(/^\/he(?=\/|$)/, '') || '/';
const matches = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(`${r}/`));

/**
 * First-touch attribution (source + utm_*) for the lead API; never overwrites an earlier touch. Also the return-to-site
 * cookie, which every deep link overwrites. See @dpl/core's attribution.ts.
 */
function withAttribution(req: NextRequest, res: NextResponse): NextResponse {
  const from = returnCookie(req.nextUrl.searchParams);
  const cookies = [...firstTouchCookies(req.nextUrl.searchParams, (name) => req.cookies.has(name)), ...(from ? [from] : [])];
  for (const c of cookies) {
    res.cookies.set(c.name, c.value, {
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
    });
  }
  return res;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // a file that exists at the root (the icons, robots.txt, sitemap.xml, llms.txt) is served as it is; any other single
  // segment with a dot ("/wp-login.php", "/.env") is a 404, not a "language" for the router to choke on
  if (looksLikeRootFile(pathname)) {
    return isRootFile(pathname) ? NextResponse.next() : NextResponse.rewrite(new URL('/en/page-not-found', req.url), { status: 404 });
  }
  // English has no prefix: /en/privacy is /privacy (a permanent redirect, so that search engines keep one address per page)
  if (/^\/en(\/|$)/.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, '') || '/';
    return NextResponse.redirect(url, 308);
  }
  const path = stripLocale(pathname);
  const prefix = pathname === '/he' || pathname.startsWith('/he/') ? '/he' : '';

  // The way in from outside: a visitor in Israel (or who chose Hebrew before, or whose link says ?lang=he) who opens an
  // English entry page is taken to the Hebrew edition; see @dpl/i18n language-choice (an explicit choice wins, crawlers
  // are never redirected). Pages inside the funnel and the portal keep the language of the lead that opened them.
  const langParam = req.nextUrl.searchParams.get('lang');
  // English only (the default): the Hebrew edition of the public pages is switched off, and any address under /he goes to
  // the English page it mirrors. The staff area keeps its Hebrew interface.
  if (!isBilingual() && prefix && !matches(path, ['/admin'])) {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.searchParams.delete('lang');
    return withAttribution(req, NextResponse.redirect(url, 307));
  }
  if (isBilingual() && !prefix && LANGUAGE_ENTRY.includes(pathname)) {
    const hebrew = shouldGoHebrew({
      pathname,
      method: req.method,
      accept: req.headers.get('accept'),
      userAgent: req.headers.get('user-agent'),
      country: countryOf(req.headers),
      cookie: req.cookies.get(LANG_COOKIE)?.value ?? null,
      langParam,
    });
    if (hebrew) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === '/' ? '/he' : `/he${pathname}`;
      url.searchParams.delete('lang');
      const redirect = withAttribution(req, NextResponse.redirect(url, 307));
      // only a stated preference is remembered, not the country the visit happens to come from
      if (langParam === 'he') redirect.cookies.set(LANG_COOKIE, 'he', { ...LANG_COOKIE_OPTIONS, secure: req.nextUrl.protocol === 'https:' });
      return redirect;
    }
  }

  // This app has no landing page of its own any more: a bare visit to '/' (no `entry` at all — this is the portal's
  // own domain) shows the portal itself, same as an explicit '/?entry=signin' or '/?entry=portal' deep link: sign-in
  // without a session, /portal with one. Only a deep link naming something else, 'eligibility' included, goes to the
  // firm's own site, where the eligibility funnel and the rest of the landing content now live (see
  // lib/landing-entry.ts).
  if (path === '/') {
    const entry = req.nextUrl.searchParams.get('entry');
    const probe = NextResponse.next();
    const hasSession = entryNeedsSession(entry) ? Boolean((await refreshSession(req, probe)).user) : false;
    const target = entryTarget(entry, hasSession);
    let redirect: NextResponse;
    if (target.kind === 'internal') {
      const url = req.nextUrl.clone();
      url.pathname = `${prefix}${target.path}`;
      url.search = '';
      redirect = NextResponse.redirect(url);
    } else {
      const mainSite = (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il').replace(/\/$/, '');
      const url = new URL(`${mainSite}${prefix}${target.path}`);
      // everything but `entry` itself (source, utm_*, ...) must survive the hop: it is this visit's attribution,
      // which the firm's site needs to capture for itself now that the funnel lives there
      const params = new URLSearchParams(req.nextUrl.searchParams);
      params.delete('entry');
      url.search = params.toString();
      redirect = NextResponse.redirect(url, 308);
    }
    for (const c of probe.cookies.getAll()) redirect.cookies.set(c);
    return withAttribution(req, redirect);
  }

  const response = withAttribution(req, intl(req));
  // ?lang=en is a choice too (the firm's site passes it on): remember it so the next page agrees
  if (isBilingual() && !prefix && chosenLanguage({ cookie: null, langParam }) === 'en' && req.cookies.get(LANG_COOKIE)?.value !== 'en') {
    response.cookies.set(LANG_COOKIE, 'en', { ...LANG_COOKIE_OPTIONS, secure: req.nextUrl.protocol === 'https:' });
  }
  if (!matches(path, SESSION_AWARE)) return response;

  const { user } = await refreshSession(req, response);
  if (!user && matches(path, PROTECTED)) {
    const url = new URL(`${prefix}/sign-in`, req.url);
    url.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return withAttribution(req, NextResponse.redirect(url));
  }
  return response;
}

// Not the API, the build output and files in folders (/images/logo.webp). A single segment with a dot (/favicon.ico,
// /wp-login.php) is included: it is either a file of ROOT_FILES or a 404. Emailed /go/<payload>.<signature> links, and
// the /enter/<payload>.<signature> links "Go to my portal" follows in from the firm's own site, contain a dot too and
// need the locale rewrite, so they are listed on their own.
export const config = { matcher: ['/((?!api|_next|_vercel|.*/.*\\..*).*)', '/go/:path*', '/he/go/:path*', '/enter/:path*', '/he/enter/:path*'] };
