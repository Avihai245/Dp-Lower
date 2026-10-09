import type { NextRequest } from 'next/server';
import { localeOf } from '@/server/auth';
import { openFromEmailLink } from '@/server/go';

export const dynamic = 'force-dynamic';

/** /go/[token] and /he/go/[token] (the intl middleware adds the English prefix to /go/... by rewriting). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  return openFromEmailLink(req, localeOf(locale), token);
}

/** Link checkers and mail scanners often probe with HEAD: that must never sign anybody in or verify anything. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
