import type { NextRequest } from 'next/server';
import { openFromEmailLink } from '@/server/go';

export const dynamic = 'force-dynamic';

/**
 * English /go/[token] reached WITHOUT the intl middleware. The signed token contains a dot, and the middleware
 * matcher skips every path with a dot (it treats it as a static file), so the rewrite to /en/go/[token] never
 * happens for these links. This handler answers them directly; Hebrew (/he/go/...) and any token without a dot
 * are served by app/[locale]/go/[token]. Both call the same function.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return openFromEmailLink(req, 'en', token);
}

/** Link checkers and mail scanners often probe with HEAD: that must never sign anybody in or verify anything. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
