import { refreshSession } from '@dpl/db/middleware';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { COOKIE_MAX_AGE_SECONDS, firstTouchCookies, returnCookie } from './lib/attribution';
import { entryNeedsSession, entryTarget } from './lib/landing-entry';

const intl = createMiddleware(routing);

/** Pages that need a signed-in user. /admin additionally checks the staff role in its layout. */
const PROTECTED = ['/portal', '/admin'];
/** Pages that read or refresh the session cookie. Everything else stays free of Supabase round trips. */
const SESSION_AWARE = [...PROTECTED, '/sign-in', '/create-password', '/auth'];

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
  const path = stripLocale(pathname);
  const prefix = pathname === '/he' || pathname.startsWith('/he/') ? '/he' : '';

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
  if (!matches(path, SESSION_AWARE)) return response;

  const { user } = await refreshSession(req, response);
  if (!user && matches(path, PROTECTED)) {
    const url = new URL(`${prefix}/sign-in`, req.url);
    url.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return withAttribution(req, NextResponse.redirect(url));
  }
  return response;
}

// Emailed /go/<payload>.<signature> links contain a dot, which the general rule would skip as a "static file":
// they need the locale rewrite too.
export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/go/:path*', '/he/go/:path*'] };
