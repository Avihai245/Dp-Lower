import {
  APPLICANT_STATUS_OPTIONS,
  DOC_TYPES,
  LEAD_STAGES,
  digitsOf,
  emailSchema,
  multiLine,
  nameSchema,
  oneLine,
} from '@dpl/core';
import { z } from 'zod';
import { TIME_RE } from '../components/admin/model';

/**
 * Input schemas of the CRM Server Actions. Plain zod (no server-only) so the unit tests can import them.
 * Ids are accepted in any UUID shape Postgres produces; everything else is closed enums or bounded strings.
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'invalid_id');

export const NEXT_ACTION_CODES = [
  'send_portal_invite',
  'send_reminder',
  'send_document_reminder',
  'move_to_review',
  'assign_to_me',
  'send_status_update',
  'send_closing_email',
] as const;

export const moveStageInput = z.object({ leadId: uuid, stage: z.enum(LEAD_STAGES) });
export const setStatusInput = z.object({ leadId: uuid, status: z.enum(APPLICANT_STATUS_OPTIONS) });
export const nextActionInput = z.object({ leadId: uuid, expected: z.enum(NEXT_ACTION_CODES) });
export const docActionInput = z.object({
  leadId: uuid,
  docType: z.enum(DOC_TYPES),
  action: z.enum(['request', 'remind', 'receive', 'reject']),
  note: z.string().transform(oneLine).pipe(z.string().max(1000)).optional(),
});
export const addNoteInput = z.object({ leadId: uuid, body: z.string().transform(multiLine).pipe(z.string().min(1).max(5000)) });
export const deleteNoteInput = z.object({ noteId: uuid });
export const assignOwnerInput = z.object({ leadId: uuid, ownerId: uuid.nullable() });
export const updateContactInput = z.object({
  leadId: uuid,
  fullName: nameSchema,
  email: emailSchema,
  /** empty is allowed only for a lead that has no phone yet (checked against the stored lead) */
  phone: z
    .string()
    .transform(oneLine)
    .pipe(z.string().max(40).refine((v) => v === '' || digitsOf(v).length >= 7, 'invalid_phone')),
});
export const leadOnlyInput = z.object({ leadId: uuid });
/** Deleting an applicant needs the case reference typed back, so it cannot happen by a stray click. */
export const deleteApplicantInput = z.object({ leadId: uuid, confirm: z.string().trim().min(1).max(40) });
export const inboxStatusInput = z.object({
  kind: z.enum(['callback', 'contact']),
  id: uuid,
  status: z.enum(['new', 'in_progress', 'closed']),
});

// -- availability -------------------------------------------------------------------------------------------------

export const timeHHMM = z.string().regex(TIME_RE, 'invalid_time');

const isRealDate = (s: string): boolean => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').refine(isRealDate, 'invalid_date');

export const ruleFields = {
  weekday: z.number().int().min(0).max(6),
  startTime: timeHHMM,
  capacity: z.number().int().min(0).max(50),
  active: z.boolean(),
};
/** whose calendar: a lawyer's staff id, or null / absent for the unassigned template (a blocked day: closed for everyone) */
const scopeField = uuid.nullable().optional();
export const addRuleInput = z.object({ ...ruleFields, staffId: scopeField });
export const updateRuleInput = z.object({ id: uuid, ...ruleFields });
export const deleteByIdInput = z.object({ id: uuid });
export const addExceptionInput = z.object({
  onDate: isoDate,
  /** null blocks the whole day */
  startTime: timeHHMM.nullable(),
  reason: z.string().transform(oneLine).pipe(z.string().max(200)).optional(),
  staffId: scopeField,
});

// -- booked calls ------------------------------------------------------------------------------------------------

/** "Mark call held", "Mark no-show", "Cancel call" on the lead page */
export const callActionInput = z.object({ leadId: uuid, bookingId: uuid, action: z.enum(['held', 'no_show', 'cancel']) });

// -- team ---------------------------------------------------------------------------------------------------------

export const updateStaffInput = z.object({
  userId: uuid,
  role: z.enum(['admin', 'lawyer', 'case_manager']),
  active: z.boolean(),
});
