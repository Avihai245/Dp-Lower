import { createAdminSupabase } from '@dpl/db/admin';
import { assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { z } from 'zod';
import { unsubscribeByToken } from '@/server/unsubscribe';

export const dynamic = 'force-dynamic';

const body = z.object({ token: z.string().min(10).max(1024) });

/**
 * Stops the nurture emails. The signed token in the email proves which lead it is; it never expires and grants
 * nothing else. Only ever reached by the confirm button on /unsubscribe, never by merely opening the link. (Mail providers'
 * one-click unsubscribe, RFC 8058, has its own address: /api/unsubscribe/one-click.)
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'unsubscribe', { windowSeconds: 60, max: 10 });
  const { token } = await parseJson(req, body);
  await unsubscribeByToken(createAdminSupabase(), token);
  return json({ ok: true });
});
