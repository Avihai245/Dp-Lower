import { refreshSession } from '@dpl/db/middleware';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Pages that need a signed-in user. /admin additionally checks the staff role in its layout. */
const PROTECTED = ['/portal', '/admin'];
/** Pages that read or refresh the session cookie. Everything else stays free of Supabase round trips. */
const SESSION_AWARE = [...PROTECTED, '/sign-in', '/create-password', '/auth'];

const stripLocale = (p: string) => p.replace(/^\/he(?=\/|$)/, '') || '/';
const matches = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(`${r}/`));

export default async function middleware(req: NextRequest) {
  const response = intl(req);
  const path = stripLocale(req.nextUrl.pathname);
  if (!matches(path, SESSION_AWARE)) return response;

  const { user } = await refreshSession(req, response);
  if (!user && matches(path, PROTECTED)) {
    const prefix = req.nextUrl.pathname.startsWith('/he') ? '/he' : '';
    const url = new URL(`${prefix}/sign-in`, req.url);
    url.searchParams.set('next', `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
