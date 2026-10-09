import { refreshSession } from '@dpl/db/middleware';
import { LANG_COOKIE, LANG_COOKIE_OPTIONS, chosenLanguage, countryOf, shouldGoHebrew } from '@dpl/i18n';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { COOKIE_MAX_AGE_SECONDS, firstTouchCookies, returnCookie } from './lib/attribution';
import { entryNeedsSession, entryTarget } from './lib/landing-entry';
import { isBilingual } from './lib/bilingual';
import { isRootFile, looksLikeRootFile } from './lib/root-files';

const intl = createMiddleware(routing);

/** Pages that need a signed-in user. /admin additionally checks the staff role in its layout. */
const PROTECTED = ['/portal', '/admin'];
/** Pages that read or refresh the session cookie. Everything else stays free of Supabase round trips. */
const SESSION_AWARE = [...PROTECTED, '/sign-in', '/create-password', '/auth'];

/** The English entry pages where the language default applies (see below). */
const LANGUAGE_ENTRY = ['/', '/privacy', '/eligibility', '/sign-in'];

const stripLocale = (p: string) => p.replace(/^\/he(?=\/|$)/, '') || '/';
const matches = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(`${r}/`));

/**
 * First-touch attribution (source + utm_*) for the lead API; never overwrites an earlier touch. Also the return-to-site
 * cookie, which every deep link overwrites. See lib/attribution.ts.
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

  // Platform deep links: /?entry=eligibility|signin|portal&source=<origin> (other sites send visitors straight into
  // the system). Handled here so the landing page itself stays a static page.
  const entry = req.nextUrl.searchParams.get('entry');
  if (path === '/' && entryTarget(entry, false) !== null) {
    const probe = NextResponse.next();
    const hasSession = entryNeedsSession(entry) ? Boolean((await refreshSession(req, probe)).user) : false;
    const url = req.nextUrl.clone();
    url.pathname = `${prefix}${entryTarget(entry, hasSession)}`;
    url.search = '';
    const redirect = NextResponse.redirect(url);
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
// /wp-login.php) is included: it is either a file of ROOT_FILES or a 404. Emailed /go/<payload>.<signature> links contain
// a dot too and need the locale rewrite, so they are listed on their own.
export const config = { matcher: ['/((?!api|_next|_vercel|.*/.*\\..*).*)', '/go/:path*', '/he/go/:path*'] };
