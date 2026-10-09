import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { readUnsubscribeToken } from '@dpl/db/links';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const body = z.object({ token: z.string().min(10).max(1024) });

/**
 * Stops the nurture emails. The signed token in the email proves which lead it is; it never expires and grants
 * nothing else. Only ever reached by the confirm button on /unsubscribe, never by merely opening the link.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'unsubscribe', { windowSeconds: 60, max: 10 });
  const { token } = await parseJson(req, body);
  const parsed = await readUnsubscribeToken(token);
  if (!parsed) throw new ApiError(400, 'invalid_token');

  const db = createAdminSupabase();
  const { data: lead, error } = await db.from('leads').select('*').eq('id', parsed.leadId).maybeSingle();
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
  if (!lead) throw new ApiError(400, 'invalid_token');

  if (!lead.unsubscribed_at) {
    const { data, error: upErr } = await db
      .from('leads')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('id', lead.id)
      .select('*')
      .single();
    if (upErr || !data) throw new Error(`unsubscribe update failed: ${upErr?.message ?? 'no row'}`);
    await logActivity(db, { leadId: lead.id, code: 'unsubscribed', text: 'Unsubscribed from the emails' });
    await enqueueEvent(db, {
      type: 'unsubscribed',
      leadId: lead.id,
      payload: { lead: leadSnapshot(data) },
      dedupeKey: `unsubscribed:${lead.id}`,
    });
  }
  return json({ ok: true });
});
