import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  DOC_TYPES,
  isApplicationComplete,
  nextAction,
  type DocType,
  type LeadStage,
  type LeadStatus,
  type NextActionCode,
} from '@dpl/core';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { Db, LeadRow } from '@dpl/db/types';
import type { ActionResult } from '@/components/admin/types';
import { queueEmail } from './email';
import { DOC_EN, STAGE_EN, STATUS_EN } from './crm-labels';
import { asStringMap, done, fail, getLead, missingDocTypes, receivedDocTypes } from './crm-util';
import type { StaffSession } from './staff';

/**
 * Mutations behind the CRM Server Actions. They take the service-role client (the action has already run
 * requireStaff() and validated the input) and the acting staff member, and for every change they write the three
 * records ARCHITECTURE section 9 asks for: the row itself, an activity_log entry (kind 'staff', stable `code`,
 * English `text`) and the outbox event / email.
 */

type Actor = StaffSession['actor'];

const log = (db: Db, actor: Actor, leadId: string, code: string, text: string, meta: Record<string, unknown> = {}) =>
  logActivity(db, { leadId, kind: 'staff', code, text, actor, meta });

/** Every deliberate click may send; the key only protects against the same request being replayed. */
const sendKey = (template: string, leadId: string) => `staff:${template}:${leadId}:${randomUUID()}`;

// -- stage ---------------------------------------------------------------------------------------------------------

export async function moveStage(db: Db, actor: Actor, leadId: string, to: LeadStage): Promise<ActionResult<{ stage: LeadStage }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  if (lead.stage === to) return done({ stage: to });

  // a new stage starts a new "next action": clear the "Done ..." line
  const { data: updated, error } = await db
    .from('leads')
    .update({ stage: to, next_action_done_at: null })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error || !updated) return fail('internal');

  await log(db, actor, leadId, 'stage_changed', `Stage changed: ${STAGE_EN[lead.stage]} → ${STAGE_EN[to]}`, { from: lead.stage, to });
  await enqueueEvent(db, {
    type: 'stage.changed',
    leadId,
    payload: { lead: leadSnapshot(updated), from: lead.stage, to, by: actor.name },
  });
  return done({ stage: to });
}

// -- applicant-facing status ---------------------------------------------------------------------------------------

export async function setStatus(db: Db, actor: Actor, leadId: string, status: LeadStatus): Promise<ActionResult<{ status: LeadStatus }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  if (lead.status === status) return done({ status });

  const { data: updated, error } = await db.from('leads').update({ status }).eq('id', leadId).select('*').single();
  if (error || !updated) return fail('internal');

  await log(db, actor, leadId, 'status_changed', `Applicant status set to ${STATUS_EN[status]}`, { from: lead.status, to: status });
  await enqueueEvent(db, {
    type: 'status.changed',
    leadId,
    payload: { lead: leadSnapshot(updated), from: lead.status, to: status, by: actor.name },
  });
  await queueEmail({ template: 'status-update', lead: updated, data: { status }, dedupeKey: sendKey('status-update', leadId) });
  return done({ status });
}

// -- owner ---------------------------------------------------------------------------------------------------------

export async function assignOwner(db: Db, actor: Actor, leadId: string, ownerId: string | null): Promise<ActionResult<{ ownerId: string | null }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  if (lead.owner_id === ownerId) return done({ ownerId });

  let ownerName = '';
  if (ownerId) {
    const { data: owner } = await db.from('staff').select('user_id,full_name,active').eq('user_id', ownerId).maybeSingle();
    if (!owner || !owner.active) return fail('invalid', 'ownerId');
    ownerName = owner.full_name;
  }
  const { error } = await db.from('leads').update({ owner_id: ownerId }).eq('id', leadId);
  if (error) return fail('internal');
  if (ownerId) await log(db, actor, leadId, 'owner_assigned', `Assigned to ${ownerName}`, { ownerId, ownerName });
  else await log(db, actor, leadId, 'owner_cleared', 'Unassigned', { previous: lead.owner_id });
  return done({ ownerId });
}

// -- notes ---------------------------------------------------------------------------------------------------------

export async function addNote(db: Db, actor: Actor, leadId: string, body: string): Promise<ActionResult<{ id: string }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  const { data, error } = await db
    .from('lead_notes')
    .insert({ lead_id: leadId, author_id: actor.id, author_name: actor.name, body })
    .select('id')
    .single();
  if (error || !data) return fail('internal');
  await log(db, actor, leadId, 'note_added', 'Note added');
  return done({ id: data.id });
}

export async function deleteNote(db: Db, actor: Actor, noteId: string): Promise<ActionResult> {
  const { data: note } = await db.from('lead_notes').select('id,lead_id').eq('id', noteId).maybeSingle();
  if (!note) return fail('not_found');
  const { error } = await db.from('lead_notes').delete().eq('id', noteId);
  if (error) return fail('internal');
  await log(db, actor, note.lead_id, 'note_deleted', 'Note deleted');
  return done();
}

// -- documents -----------------------------------------------------------------------------------------------------

export type DocOp = 'request' | 'remind' | 'receive' | 'reject';

export async function docAction(
  db: Db,
  actor: Actor,
  a: { leadId: string; docType: DocType; op: DocOp; note?: string },
): Promise<ActionResult<{ status: string }>> {
  const lead = await getLead(db, a.leadId);
  if (!lead) return fail('not_found');
  const { data: doc } = await db.from('documents').select('*').eq('lead_id', a.leadId).eq('doc_type', a.docType).maybeSingle();
  const status = doc?.status ?? 'missing';
  const now = new Date().toISOString();
  const name = DOC_EN[a.docType];

  if (a.op === 'request' || a.op === 'remind') {
    if (status === 'received') return fail('conflict');
    const reminder = a.op === 'remind' || status === 'requested';
    const { error } = await db
      .from('documents')
      .upsert({ lead_id: a.leadId, doc_type: a.docType, status: 'requested', requested_at: now, review_note: null }, { onConflict: 'lead_id,doc_type' });
    if (error) return fail('internal');
    await log(db, actor, a.leadId, reminder ? 'doc_reminded' : 'doc_requested', reminder ? `Reminder sent for ${name}` : `Document requested: ${name}`, {
      docType: a.docType,
    });
    if (!reminder) await documentEvent(db, lead, actor, a.docType, 'requested');
    await queueEmail({ template: 'document-requested', lead, data: { docTypes: [a.docType] }, dedupeKey: sendKey('document-requested', a.leadId) });
    return done({ status: 'requested' });
  }

  if (a.op === 'receive') {
    const { error } = await db
      .from('documents')
      .upsert(
        { lead_id: a.leadId, doc_type: a.docType, status: 'received', reviewed_by: actor.id, reviewed_at: now, review_note: null },
        { onConflict: 'lead_id,doc_type' },
      );
    if (error) return fail('internal');
    await log(db, actor, a.leadId, 'doc_received', `Document marked received: ${name}`, { docType: a.docType });
    await documentEvent(db, lead, actor, a.docType, 'received');
    return done({ status: 'received' });
  }

  // reject: only a document that has been received can be sent back
  if (status !== 'received') return fail('conflict');
  const note = a.note?.trim() || null;
  const { error } = await db
    .from('documents')
    .update({ status: 'reupload', review_note: note, reviewed_by: actor.id, reviewed_at: now })
    .eq('lead_id', a.leadId)
    .eq('doc_type', a.docType);
  if (error) return fail('internal');
  await log(db, actor, a.leadId, 'doc_rejected', `Document rejected, re-upload requested: ${name}`, { docType: a.docType, note });
  await documentEvent(db, lead, actor, a.docType, 'reupload', note);
  await queueEmail({ template: 'document-rejected', lead, data: { docType: a.docType, note }, dedupeKey: sendKey('document-rejected', a.leadId) });
  return done({ status: 'reupload' });
}

async function documentEvent(db: Db, lead: LeadRow, actor: Actor, docType: DocType, status: string, note?: string | null) {
  await enqueueEvent(db, {
    type: 'document.reviewed',
    leadId: lead.id,
    payload: { lead: leadSnapshot(lead), docType, status, note: note ?? null, by: actor.name },
  });
}

// -- next action ---------------------------------------------------------------------------------------------------

async function fileOpenData(db: Db, lead: LeadRow) {
  const [{ data: app }, received] = await Promise.all([
    db.from('applications').select('data,completed_at').eq('lead_id', lead.id).maybeSingle(),
    receivedDocTypes(db, lead.id),
  ]);
  const data = asStringMap(app?.data);
  const complete = isApplicationComplete(data) || app?.completed_at != null;
  const started = Object.values(data).some((v) => v.trim() !== '');
  return {
    applicationState: complete ? ('complete' as const) : started ? ('in_progress' as const) : ('not_started' as const),
    docsReceived: received.size,
    docsTotal: DOC_TYPES.length,
  };
}

/**
 * The "Next action" card's button. The action is worked out again here from the stored stage and documents (the
 * browser only says which one it is looking at, and is told 'stale' when the case has moved on).
 */
export async function runNextAction(db: Db, actor: Actor, leadId: string, expected: NextActionCode): Promise<ActionResult<{ code: NextActionCode }>> {
  const lead = await getLead(db, leadId);
  if (!lead) return fail('not_found');
  const received = await receivedDocTypes(db, leadId);
  const missing = missingDocTypes(received);
  const code = nextAction(lead.stage, missing.length);
  if (code !== expected) return fail('stale');

  let logged: { code: string; text: string; meta?: Record<string, unknown> };
  switch (code) {
    case 'move_to_review': {
      const moved = await moveStage(db, actor, leadId, 'review');
      return moved.ok ? done({ code }) : moved;
    }
    case 'assign_to_me': {
      const { error } = await db.from('leads').update({ owner_id: actor.id }).eq('id', leadId);
      if (error) return fail('internal');
      logged = { code: 'owner_assigned', text: `Assigned to ${actor.name}`, meta: { ownerId: actor.id, ownerName: actor.name } };
      break;
    }
    case 'send_portal_invite':
    case 'send_reminder': {
      await queueEmail({ template: 'file-open', lead, data: await fileOpenData(db, lead), dedupeKey: sendKey('file-open', leadId) });
      logged =
        code === 'send_portal_invite'
          ? { code: 'portal_invite_sent', text: `Portal invite sent to ${lead.email}`, meta: { email: lead.email } }
          : { code: 'reminder_sent', text: `Reminder sent to ${lead.email}`, meta: { email: lead.email } };
      break;
    }
    case 'send_document_reminder': {
      await queueEmail({ template: 'document-requested', lead, data: { docTypes: missing }, dedupeKey: sendKey('document-requested', leadId) });
      logged = { code: 'doc_reminder_sent', text: `Document reminder sent to ${lead.email}`, meta: { email: lead.email, docTypes: missing } };
      break;
    }
    case 'send_status_update': {
      await queueEmail({ template: 'status-update', lead, data: { status: lead.status }, dedupeKey: sendKey('status-update', leadId) });
      logged = { code: 'status_update_sent', text: `Status update sent to ${lead.email}`, meta: { email: lead.email, status: lead.status } };
      break;
    }
    case 'send_closing_email': {
      await queueEmail({ template: 'status-update', lead, data: { status: 'review_completed' }, dedupeKey: sendKey('status-update', leadId) });
      logged = { code: 'closing_email_sent', text: `Closing email sent to ${lead.email}`, meta: { email: lead.email } };
      break;
    }
  }
  await db.from('leads').update({ next_action_done_at: new Date().toISOString() }).eq('id', leadId);
  await log(db, actor, leadId, logged.code, logged.text, logged.meta);
  return done({ code });
}
