'use server';

import { isLocale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { rateLimit } from '@dpl/db/rate-limit';
import { createServerSupabase } from '@dpl/db/server';
import type { Db } from '@dpl/db/types';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import type { ActionResult } from '@/components/admin/types';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';

import { addException, addRule, deleteException, deleteRule, updateRule } from '@/server/crm-availability';
import { updateContact, sendResetLink } from '@/server/crm-contact';
import { deleteApplicant } from '@/server/crm-erase';
import { setInboxStatus } from '@/server/crm-inbox';
import {
  addExceptionInput,
  addNoteInput,
  addRuleInput,
  assignOwnerInput,
  deleteApplicantInput,
  deleteByIdInput,
  deleteNoteInput,
  docActionInput,
  inboxStatusInput,
  leadOnlyInput,
  moveStageInput,
  nextActionInput,
  setStatusInput,
  updateContactInput,
  updateRuleInput,
  updateStaffInput,
} from '@/server/crm-schemas';
import { updateStaff } from '@/server/crm-team';
import { addNote, assignOwner, deleteNote, docAction, moveStage, runNextAction, setStatus } from '@/server/crm-write';
import { errorCode, requireAdmin, requireStaff, type StaffSession } from '@/server/staff';

/**
 * Server Actions of the CRM. The shape of every one of them:
 *   1. requireStaff() / requireAdmin() FIRST: the page that rendered the button is never trusted;
 *   2. zod validation of the input;
 *   3. the work, with the service-role client, which records the actor in activity_log and queues outbox events;
 *   4. revalidation, so the list, the board and the counters in the layout show the change.
 * They never throw to the browser: the result is { ok: true, data } or { ok: false, error }.
 */

type Guard = () => Promise<StaffSession>;

/** Per staff member: calls per minute across all CRM actions. */
const ACTION_LIMIT = { windowSeconds: 60, max: 240 };

/**
 * The layout of the CRM route group, which holds the lead rows, the inbox count and the staff list. Revalidating just
 * this layout (not '/') makes the action's response carry fresh data for every CRM page, without purging the cached
 * public pages of the site on every click.
 */
const CRM_LAYOUT = '/[locale]/(admin)';

async function run<S extends z.ZodType, T>(
  guard: Guard,
  schema: S,
  input: unknown,
  work: (db: Db, session: StaffSession, data: z.output<S>) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const session = await guard();
    const db = createAdminSupabase();
    // far above what a person can do with the buttons; stops a runaway script holding a staff session
    if (!(await rateLimit(db, `admin:${session.actor.id}`, ACTION_LIMIT))) return { ok: false, error: 'rate_limited' };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid', field: parsed.error.issues[0]?.path.join('.') };
    const result = await work(db, session, parsed.data);
    if (result.ok) revalidatePath(CRM_LAYOUT, 'layout');
    return result;
  } catch (e) {
    const code = errorCode(e);
    if (code === 'internal') console.error('[admin action]', e);
    return { ok: false, error: code };
  }
}

// -- leads ---------------------------------------------------------------------------------------------------------

export async function moveStageAction(input: z.input<typeof moveStageInput>) {
  return run(requireStaff, moveStageInput, input, (db, s, a) => moveStage(db, s.actor, a.leadId, a.stage));
}

export async function setStatusAction(input: z.input<typeof setStatusInput>) {
  return run(requireStaff, setStatusInput, input, (db, s, a) => setStatus(db, s.actor, a.leadId, a.status));
}

export async function nextActionAction(input: z.input<typeof nextActionInput>) {
  return run(requireStaff, nextActionInput, input, (db, s, a) => runNextAction(db, s.actor, a.leadId, a.expected));
}

export async function assignOwnerAction(input: z.input<typeof assignOwnerInput>) {
  return run(requireStaff, assignOwnerInput, input, (db, s, a) => assignOwner(db, s.actor, a.leadId, a.ownerId));
}

export async function addNoteAction(input: z.input<typeof addNoteInput>) {
  return run(requireStaff, addNoteInput, input, (db, s, a) => addNote(db, s.actor, a.leadId, a.body));
}

export async function deleteNoteAction(input: z.input<typeof deleteNoteInput>) {
  return run(requireStaff, deleteNoteInput, input, (db, s, a) => deleteNote(db, s.actor, a.noteId));
}

export async function documentAction(input: z.input<typeof docActionInput>) {
  return run(requireStaff, docActionInput, input, (db, s, a) =>
    docAction(db, s.actor, { leadId: a.leadId, docType: a.docType, op: a.action, note: a.note }),
  );
}

export async function updateContactAction(input: z.input<typeof updateContactInput>) {
  return run(requireStaff, updateContactInput, input, (db, s, a) => updateContact(db, s.actor, a));
}

export async function sendResetLinkAction(input: z.input<typeof leadOnlyInput>) {
  return run(requireStaff, leadOnlyInput, input, (db, s, a) => sendResetLink(db, s.actor, a.leadId));
}

/** Admins only: removes an applicant and everything held about them (see crm-erase.ts). */
export async function deleteApplicantAction(input: z.input<typeof deleteApplicantInput>) {
  return run(requireAdmin, deleteApplicantInput, input, (db, s, a) => deleteApplicant(db, s.actor, a.leadId, a.confirm));
}

// -- inbox ---------------------------------------------------------------------------------------------------------

export async function setInboxStatusAction(input: z.input<typeof inboxStatusInput>) {
  return run(requireStaff, inboxStatusInput, input, (db, s, a) => setInboxStatus(db, s.actor, a));
}

// -- availability and team: admins only -----------------------------------------------------------------------------

export async function addRuleAction(input: z.input<typeof addRuleInput>) {
  return run(requireAdmin, addRuleInput, input, (db, _s, a) => addRule(db, a));
}

export async function updateRuleAction(input: z.input<typeof updateRuleInput>) {
  return run(requireAdmin, updateRuleInput, input, (db, _s, a) => updateRule(db, a));
}

export async function deleteRuleAction(input: z.input<typeof deleteByIdInput>) {
  return run(requireAdmin, deleteByIdInput, input, (db, _s, a) => deleteRule(db, a.id));
}

export async function addExceptionAction(input: z.input<typeof addExceptionInput>) {
  return run(requireAdmin, addExceptionInput, input, (db, _s, a) => addException(db, a));
}

export async function deleteExceptionAction(input: z.input<typeof deleteByIdInput>) {
  return run(requireAdmin, deleteByIdInput, input, (db, _s, a) => deleteException(db, a.id));
}

export async function updateStaffAction(input: z.input<typeof updateStaffInput>) {
  return run(requireAdmin, updateStaffInput, input, (db, _s, a) => updateStaff(db, a));
}

// -- session -------------------------------------------------------------------------------------------------------

/** Ends the caller's own session (no staff check: it only ever touches the caller's cookies). */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const raw = await getLocale();
  redirect({ href: '/sign-in', locale: isLocale(raw) ? raw : 'en' });
}
