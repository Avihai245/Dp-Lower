import 'server-only';
import {
  advanceStage,
  advanceStatus,
  DOC_TYPES,
  isApplicationComplete,
  sectionsDone as countSectionsDone,
  type ApplicationSaveInput,
} from '@dpl/core';
import { ApiError } from '@dpl/db/http';
import { cancelPendingNurture, enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { asJson, type Db, type LeadRow } from '@dpl/db/types';
import { cleanApplicationData } from '@/components/portal/model/state';
import { queueEmail } from './email';

const MAX_MERGE_ATTEMPTS = 8;
/** PostgreSQL unique_violation */
const UNIQUE_VIOLATION = '23505';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(what: string, message: string): never {
  throw new Error(`portal: ${what} failed: ${message}`);
}

export interface SaveResult {
  sectionsDone: number;
  complete: boolean;
  /** true when this save was the first one (application_started_at was set) */
  started: boolean;
}

/**
 * Autosave: merges the posted fields into applications.data (one row per lead, created on the first save) and records
 * which section the applicant is on. Two tabs saving at the same time cannot overwrite each other's fields: the update
 * only applies to the row version that was read, and is retried on a clash.
 *
 * The first save sets application_started_at, moves the case to the "application" stage / "application_incomplete"
 * status (never backwards, never over a status the team set) and emits application.started once.
 */
export async function saveApplication(db: Db, lead: LeadRow, input: ApplicationSaveInput): Promise<SaveResult> {
  if (lead.submitted_at) throw new ApiError(409, 'already_submitted');

  let merged: ReturnType<typeof cleanApplicationData> = {};
  let saved = false;
  for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS && !saved; attempt++) {
    // a clash means another save got in between our read and write: step aside for a moment and merge again
    if (attempt > 0) await sleep(Math.random() * 30 * attempt);
    const { data: row, error } = await db.from('applications').select('*').eq('lead_id', lead.id).maybeSingle();
    if (error) fail('reading the application', error.message);

    merged = { ...cleanApplicationData(row?.data), ...input.data };
    const complete = isApplicationComplete(merged);
    const patch = {
      data: asJson(merged),
      current_section: input.currentSection ?? row?.current_section ?? 0,
      completed_at: complete ? (row?.completed_at ?? new Date().toISOString()) : null,
    };

    if (!row) {
      const { error: insertError } = await db.from('applications').insert({ lead_id: lead.id, ...patch });
      if (!insertError) saved = true;
      else if (insertError.code !== UNIQUE_VIOLATION) fail('creating the application', insertError.message);
      continue;
    }

    const { data: updated, error: updateError } = await db
      .from('applications')
      .update(patch)
      .eq('lead_id', lead.id)
      .eq('updated_at', row.updated_at)
      .select('lead_id');
    if (updateError) fail('saving the application', updateError.message);
    saved = (updated?.length ?? 0) > 0;
  }
  if (!saved) throw new ApiError(409, 'conflict');

  let started = false;
  if (!lead.application_started_at) {
    const { data: updatedLead, error } = await db
      .from('leads')
      .update({
        application_started_at: new Date().toISOString(),
        stage: advanceStage(lead.stage, 'application_started'),
        status: advanceStatus(lead.status, 'application_started'),
      })
      .eq('id', lead.id)
      .is('application_started_at', null)
      .select('*')
      .maybeSingle();
    if (error) fail('starting the application', error.message);
    if (updatedLead) {
      started = true;
      await logActivity(db, { leadId: lead.id, code: 'application_started', text: 'Application started' });
      await enqueueEvent(db, {
        type: 'application.started',
        leadId: lead.id,
        payload: { lead: leadSnapshot(updatedLead), startedAt: updatedLead.application_started_at },
        dedupeKey: `application.started:${lead.id}`,
      });
    }
  }

  return { sectionsDone: countSectionsDone(merged), complete: isApplicationComplete(merged), started };
}

export interface SubmitResult {
  submittedAt: string;
  /** true when the application had been submitted before (nothing is sent twice) */
  alreadySubmitted: boolean;
}

/**
 * "Submit my application": needs the four answer sections complete (documents are optional, "you can submit with what
 * you have"). Sets submitted_at, moves the case to "review" / "application_submitted", then emits application.submitted,
 * queues the application-received email and logs the activity. Safe to repeat: the second call changes nothing. The nurture
 * sequence stops by itself: planDrip() ends the sequence for a lead that has submitted.
 */
export async function submitApplication(db: Db, lead: LeadRow): Promise<SubmitResult> {
  if (lead.submitted_at) return { submittedAt: lead.submitted_at, alreadySubmitted: true };

  const { data: row, error } = await db.from('applications').select('*').eq('lead_id', lead.id).maybeSingle();
  if (error) fail('reading the application', error.message);
  if (!row || !isApplicationComplete(cleanApplicationData(row.data))) throw new ApiError(409, 'application_incomplete');

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from('leads')
    .update({
      submitted_at: now,
      stage: advanceStage(lead.stage, 'application_submitted'),
      status: advanceStatus(lead.status, 'application_submitted'),
    })
    .eq('id', lead.id)
    .is('submitted_at', null)
    .select('*')
    .maybeSingle();
  if (updateError) fail('submitting the application', updateError.message);
  if (!updated) {
    // another request submitted it first
    const { data: current } = await db.from('leads').select('submitted_at').eq('id', lead.id).single();
    return { submittedAt: current?.submitted_at ?? now, alreadySubmitted: true };
  }

  await db
    .from('applications')
    .update({ completed_at: row.completed_at ?? now })
    .eq('lead_id', lead.id);

  const { count } = await db
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', lead.id)
    .eq('status', 'received');
  const docsReceived = count ?? 0;
  const docsTotal = DOC_TYPES.length;

  await logActivity(db, {
    leadId: lead.id,
    code: 'application_submitted',
    text: 'Application submitted',
    meta: { docsReceived, docsTotal },
  });
  await enqueueEvent(db, {
    type: 'application.submitted',
    leadId: lead.id,
    payload: { lead: leadSnapshot(updated), submittedAt: updated.submitted_at ?? now, docsReceived, docsTotal },
    dedupeKey: `application.submitted:${lead.id}`,
  });
  await queueEmail({ template: 'application-received', lead: updated, dedupeKey: `email:application-received:${lead.id}` });
  // the nurture sequence ends with the submission: what is still queued must not go out
  await cancelPendingNurture(db, lead.id, 'cancelled: the application was submitted');

  return { submittedAt: updated.submitted_at ?? now, alreadySubmitted: false };
}
