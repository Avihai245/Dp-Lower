import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, handle, json, limitOrThrow } from '@dpl/db/http';
import { NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/server/unsubscribe';

export const dynamic = 'force-dynamic';

/**
 * The address in the `List-Unsubscribe` header of the nurture emails (RFC 8058). A mail provider's "Unsubscribe" button
 * POSTs `List-Unsubscribe=One-Click` here, from its own servers: no cookie, no Origin, no page. The signed token in the
 * query is the whole authority (it can only stop the nurture emails), and the fixed body keeps a stray request from doing
 * it. Opening the address in a browser (GET) leads to the confirmation page instead, which asks first.
 */
export const POST = handle(async (req) => {
  await limitOrThrow(req, 'unsubscribe-one-click', { windowSeconds: 60, max: 60 });
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const form = await req.formData().catch(() => null);
  if (form?.get('List-Unsubscribe') !== 'One-Click') throw new ApiError(400, 'invalid_body');
  await unsubscribeByToken(createAdminSupabase(), token);
  return json({ ok: true });
});

export function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  return NextResponse.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(token)}`, req.url), 303);
}
