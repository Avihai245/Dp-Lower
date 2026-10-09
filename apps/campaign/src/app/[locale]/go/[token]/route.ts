import type { NextRequest } from 'next/server';
import { localizePath } from '@/components/funnel/logic/paths';
import { isSameOriginRequest, localeOf, redirectTo } from '@/server/auth';
import { inspectEmailLink, openFromEmailLink } from '@/server/go';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ locale: string; token: string }> };

/**
 * /go/[token] and /he/go/[token] (the intl middleware adds the English prefix to /go/... by rewriting).
 * A link whose mailbox is not verified yet, opened from a browser that did not create the lead, shows a confirmation
 * page first (see inspectEmailLink): the destructive part only runs on the POST of its button.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { locale, token } = await params;
  const lang = localeOf(locale);
  if ((await inspectEmailLink(token)) === 'confirm') {
    return redirectTo(req, localizePath(`/open-link?t=${encodeURIComponent(token)}`, lang));
  }
  return openFromEmailLink(req, lang, token);
}

/** The confirmation button of /open-link. Same work as an unguarded GET. */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isSameOriginRequest(req)) return new Response('Forbidden', { status: 403 });
  const { locale, token } = await params;
  return openFromEmailLink(req, localeOf(locale), token);
}

/** Link checkers and mail scanners often probe with HEAD: that must never sign anybody in or verify anything. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
