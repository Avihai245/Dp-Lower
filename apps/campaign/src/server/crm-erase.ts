import 'server-only';
import { enqueueEvent } from '@dpl/db/outbox';
import type { Db } from '@dpl/db/types';
import type { ActionResult } from '@/components/admin/types';
import { done, fail, getLead } from './crm-util';
import type { StaffSession } from './staff';

const BUCKET = 'documents';

type Actor = StaffSession['actor'];

/** Every file the applicant stored: `{lead id}/{document type}/{file}` in the private bucket. */
async function listObjects(db: Db, leadId: string): Promise<string[]> {
  const files = db.storage.from(BUCKET);
  const top = await files.list(leadId, { limit: 1000 });
  if (top.error) throw new Error(`listing ${leadId}: ${top.error.message}`);
  const out: string[] = [];
  for (const entry of top.data ?? []) {
    // an entry without an id is a folder (one per document type)
    if (entry.id) {
      out.push(`${leadId}/${entry.name}`);
      continue;
    }
    const inner = await files.list(`${leadId}/${entry.name}`, { limit: 1000 });
    if (inner.error) throw new Error(`listing ${leadId}/${entry.name}: ${inner.error.message}`);
    for (const f of inner.data ?? []) if (f.id) out.push(`${leadId}/${entry.name}/${f.name}`);
  }
  return out;
}

/** `_` and `%` are wildcards in LIKE: an address must match as written. */
const likeLiteral = (v: string) => v.replace(/[\\%_]/g, '\\$&');

/**
 * The applicant's right to be forgotten, done completely: the stored files, the sign-in account, the queued emails and
 * outbox events that carry the person's details, callback requests and website enquiries with the same address, and the
 * lead itself (which takes the application, documents, bookings, notes, history and sequence state with it). What stays
 * is a record that it happened: the case reference, who did it and when (`deletion_log`), and a CRM event with the same
 * content so a connected system can mirror the deletion. Nothing in either names the person.
 *
 * Files go first: if that fails the file is still whole and the deletion can simply be repeated.
 */
export async function deleteApplicant(db: Db, actor: Actor, leadId: string, confirm: string): Promise<ActionResult<{ caseRef: string }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  if (confirm.trim().toUpperCase() !== lead.case_ref.toUpperCase()) return fail('confirm_mismatch');

  try {
    const objects = await listObjects(db, lead.id);
    for (let i = 0; i < objects.length; i += 100) {
      const { error } = await db.storage.from(BUCKET).remove(objects.slice(i, i + 100));
      if (error) throw new Error(`removing files: ${error.message}`);
    }

    // the sign-in account (never a staff account: staff are not leads)
    if (lead.user_id) {
      const { data: staff } = await db.from('staff').select('user_id').eq('user_id', lead.user_id).maybeSingle();
      if (!staff) {
        const { error } = await db.auth.admin.deleteUser(lead.user_id);
        if (error && error.status !== 404) throw new Error(`removing the account: ${error.message}`);
      }
    }

    // rows that would outlive the lead and still hold the person's details
    for (const step of [
      db.from('events').delete().eq('lead_id', lead.id),
      db.from('callback_requests').delete().eq('lead_id', lead.id),
      db.from('contact_submissions').delete().ilike('email', likeLiteral(lead.email)),
    ]) {
      const { error } = await step;
      if (error) throw new Error(`removing related rows: ${error.message}`);
    }

    const { error } = await db.from('leads').delete().eq('id', lead.id);
    if (error) throw new Error(`removing the lead: ${error.message}`);

    await db.from('deletion_log').insert({ case_ref: lead.case_ref, deleted_by: actor.id, deleted_by_name: actor.name, storage_objects: objects.length });
    await enqueueEvent(db, {
      type: 'lead.deleted',
      payload: { caseRef: lead.case_ref, by: actor.name, deletedAt: new Date().toISOString() },
      dedupeKey: `lead.deleted:${lead.id}`,
    });
    return done({ caseRef: lead.case_ref });
  } catch (e) {
    console.error('[admin] deleteApplicant failed', e);
    return fail('internal');
  }
}
