import 'server-only';
import { logActivity } from '@dpl/db/outbox';
import type { Db } from '@dpl/db/types';
import type { ActionResult, CallbackItem, ContactItem, InboxData, InboxStatus, LeadLink } from '@/components/admin/types';
import { done, fail } from './crm-util';
import type { StaffSession } from './staff';

type Actor = StaffSession['actor'];

const LIMIT = 300;

const STATUS_EN: Record<InboxStatus, string> = { new: 'new', in_progress: 'in progress', closed: 'closed' };

/** Callback requests ("Speak with an AI Advisor") and the website's contact forms, newest first. */
export async function loadInbox(db: Db): Promise<InboxData> {
  const [cb, ct, staff] = await Promise.all([
    db.from('callback_requests').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    db.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    db.from('staff').select('user_id,full_name'),
  ]);
  for (const r of [cb, ct, staff]) if (r.error) throw new Error(r.error.message);
  const staffName = new Map((staff.data ?? []).map((s) => [s.user_id, s.full_name]));

  const leadIds = [...new Set((cb.data ?? []).map((c) => c.lead_id).filter((v): v is string => !!v))];
  const emails = [...new Set((ct.data ?? []).map((c) => c.email?.toLowerCase()).filter((v): v is string => !!v))];
  const [byId, byEmail] = await Promise.all([
    leadIds.length ? db.from('leads').select('id,case_ref,full_name,email').in('id', leadIds) : Promise.resolve({ data: [] }),
    emails.length ? db.from('leads').select('id,case_ref,full_name,email').in('email', emails) : Promise.resolve({ data: [] }),
  ]);
  const linkOf = (l: { id: string; case_ref: string; full_name: string }): LeadLink => ({ id: l.id, caseRef: l.case_ref, name: l.full_name });
  const leadById = new Map((byId.data ?? []).map((l) => [l.id, linkOf(l)]));
  const leadByEmail = new Map((byEmail.data ?? []).map((l) => [l.email, linkOf(l)]));

  const callbacks: CallbackItem[] = (cb.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    locale: c.locale,
    source: c.source,
    status: c.status,
    handledByName: c.handled_by ? (staffName.get(c.handled_by) ?? null) : null,
    note: c.note,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    lead: c.lead_id ? (leadById.get(c.lead_id) ?? null) : null,
  }));
  const contacts: ContactItem[] = (ct.data ?? []).map((c) => ({
    id: c.id,
    kind: c.kind as ContactItem['kind'],
    name: c.name,
    email: c.email,
    phone: c.phone,
    matter: c.matter,
    note: c.note,
    locale: c.locale,
    page: c.page,
    source: c.source,
    status: c.status,
    handledByName: c.handled_by ? (staffName.get(c.handled_by) ?? null) : null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    lead: c.email ? (leadByEmail.get(c.email.toLowerCase()) ?? null) : null,
  }));
  return { callbacks, contacts };
}

/** new -> in_progress -> closed (and back). `handled_by` is whoever touched it last, cleared when it is reopened as new. */
export async function setInboxStatus(
  db: Db,
  actor: Actor,
  a: { kind: 'callback' | 'contact'; id: string; status: InboxStatus },
): Promise<ActionResult<{ status: InboxStatus }>> {
  const patch = { status: a.status, handled_by: a.status === 'new' ? null : actor.id };
  if (a.kind === 'contact') {
    const { data, error } = await db.from('contact_submissions').update(patch).eq('id', a.id).select('id').maybeSingle();
    if (error) return fail('internal');
    return data ? done({ status: a.status }) : fail('not_found');
  }
  const { data, error } = await db.from('callback_requests').update(patch).eq('id', a.id).select('id,lead_id').maybeSingle();
  if (error) return fail('internal');
  if (!data) return fail('not_found');
  if (data.lead_id) {
    await logActivity(db, {
      leadId: data.lead_id,
      kind: 'staff',
      code: 'callback_status',
      text: `Callback request marked ${STATUS_EN[a.status]}`,
      actor,
      meta: { status: a.status },
    });
  }
  return done({ status: a.status });
}
