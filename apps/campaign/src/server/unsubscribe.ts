import 'server-only';
import { ApiError } from '@dpl/db/http';
import { readUnsubscribeToken } from '@dpl/db/links';
import { cancelPendingNurture, enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { Db } from '@dpl/db/types';

/**
 * Stops the nurture emails of the lead the signed token names (it never expires and grants nothing else). Idempotent: also
 * when it was recorded before, what was queued since (or in a race) is cancelled. Throws ApiError 400 for a token that is
 * not an unsubscribe token or names no lead.
 */
export async function unsubscribeByToken(db: Db, token: string): Promise<void> {
  const parsed = await readUnsubscribeToken(token);
  if (!parsed) throw new ApiError(400, 'invalid_token');

  const { data: lead, error } = await db.from('leads').select('*').eq('id', parsed.leadId).maybeSingle();
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
  if (!lead) throw new ApiError(400, 'invalid_token');

  await cancelPendingNurture(db, lead.id, 'cancelled: unsubscribed');
  if (lead.unsubscribed_at) return;
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
