import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { sendFileLink } from '@/server/leads';

export const dynamic = 'force-dynamic';

/** "Email me my result instead": the "your file" email with a link into the portal, to the address on the lead. */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'result-email', { windowSeconds: 60, max: 5 });
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  const { lead } = who;

  await sendFileLink(db, lead, 'result');
  const now = new Date();
  const { error } = await db.from('leads').update({ result_emailed_at: now.toISOString() }).eq('id', lead.id);
  if (error) throw new Error(`result_emailed_at update failed: ${error.message}`);
  await enqueueEvent(db, {
    type: 'result.requested',
    leadId: lead.id,
    payload: { lead: leadSnapshot(lead) },
    dedupeKey: `result.requested:${lead.id}:${now.toISOString().slice(0, 13)}`,
  });
  await logActivity(db, { leadId: lead.id, code: 'result_emailed', text: 'Asked for the result by email' });
  return json({ ok: true });
});
