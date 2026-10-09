import 'server-only';
import { DOC_TYPES, capitalizeName, firstNameOf, routeFromAnswers, type LeadInput, type Locale } from '@dpl/core';
import { ApiError } from '@dpl/db/http';
import { getSessionLead } from '@dpl/db/lead-session';
import { cancelPendingEmails, enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { changeLeadEmail, isSameBrowser } from '@dpl/db/portal-session';
import { createServerSupabase } from '@dpl/db/server';
import { asJson, type BookingRow, type Db, type LeadRow } from '@dpl/db/types';
import { cookies } from 'next/headers';
import { answersDiffer, cleanAnswers, mergeAnswers } from '@/components/funnel/logic/answers';
import type { LeadSummary } from '@/components/funnel/logic/api-types';
import { parseFirstTouch, SRC_COOKIE, UTM_COOKIE, type FirstTouch } from '@/components/funnel/logic/first-touch';
import { loadCallSettings } from '@/server/availability';
import { announceUpdate } from '@/server/lead-events';
import { activeBooking, toBookingSummary } from '@/server/bookings';
import { restartForNewAddress, startWelcomeSequence } from '@/server/drip';
import { queueEmail } from '@/server/email';

/** Where the visitor first came from, as stored by the landing page (used when the request body does not say). */
export async function readFirstTouch(): Promise<FirstTouch> {
  const store = await cookies();
  return parseFirstTouch(store.get(SRC_COOKIE)?.value, store.get(UTM_COOKIE)?.value);
}

export type LeadOutcome =
  | { status: 'created' | 'updated'; lead: LeadRow }
  /** the email already has a file and this browser did not create it: nothing was changed */
  | { status: 'existing'; lead: LeadRow };

const hourKey = (d = new Date()) => d.toISOString().slice(0, 13);

/** The lead this browser already holds: its cookie, or the portal session it is signed in with. */
export interface CurrentLead {
  lead: LeadRow;
  via: 'cookie' | 'session';
}

/**
 * The rules of docs/ARCHITECTURE.md section 7:
 *  - new email: a new lead (lead cookie for this browser, `lead.created`, welcome sequence);
 *  - known email from the browser that created it (cookie) or one signed in as it: update name, phone, answers;
 *  - known email from anywhere else: change NOTHING, email the address owner a link to their file;
 *  - a browser that already holds a lead and sends ANOTHER address with the same name (it pressed Back from the booking
 *    and corrected a typo): the same lead moves to the new address, no second lead, no second sequence. A lead with a
 *    password, or one the browser is signed in as, keeps its address: 409 email_locked. Another name is another person.
 * The caller sets the lead cookie for `created` / `updated`.
 */
export async function submitLead(db: Db, input: LeadInput, firstTouch: FirstTouch, current: CurrentLead | null = null): Promise<LeadOutcome> {
  const { data: found, error } = await db.from('leads').select('*').eq('email', input.email).maybeSingle();
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
  if (current && current.lead.email !== input.email && isCorrection(current.lead, input)) {
    if (current.via === 'session' || current.lead.password_set_at) throw new ApiError(409, 'email_locked');
    // somebody else's file (never this browser's own: the addresses differ): the usual rule for a known email
    if (found) return handleKnownEmail(db, found, input);
    const moved = await correctEmail(db, current.lead, input);
    return moved ? { status: 'updated', lead: moved } : { status: 'existing', lead: current.lead };
  }
  if (!found) {
    const created = await createLead(db, input, firstTouch);
    if (created) return { status: 'created', lead: created };
    // a concurrent request with the same email won the unique index: carry on as for a known email
    const { data: raced } = await db.from('leads').select('*').eq('email', input.email).maybeSingle();
    if (!raced) throw new Error('lead insert failed');
    return handleKnownEmail(db, raced, input);
  }
  return handleKnownEmail(db, found, input);
}

async function handleKnownEmail(db: Db, lead: LeadRow, input: LeadInput): Promise<LeadOutcome> {
  if (await isSameBrowser(db, lead)) {
    const u = await updateLead(db, lead, input);
    await announceUpdate(db, u.lead, u.changed);
    return { status: 'updated', lead: u.lead };
  }
  await enqueueEvent(db, {
    type: 'lead.returned',
    leadId: lead.id,
    payload: { lead: leadSnapshot(lead) },
    dedupeKey: `lead.returned:${lead.id}:${hourKey()}`,
  });
  await sendFileLink(db, lead, 'returned');
  return { status: 'existing', lead };
}

async function createLead(db: Db, input: LeadInput, firstTouch: FirstTouch): Promise<LeadRow | null> {
  const answers = cleanAnswers(input.answers);
  const { data, error } = await db
    .from('leads')
    .insert({
      full_name: capitalizeName(input.fullName),
      email: input.email,
      phone: input.phone,
      locale: input.locale,
      route: routeFromAnswers(answers),
      answers: asJson(answers),
      // the column default ('campaign-ger-aus') applies when neither the body nor the first-touch cookie names a source
      ...(input.source || firstTouch.source ? { source: input.source ?? firstTouch.source } : {}),
      utm: asJson(input.utm ?? firstTouch.utm ?? {}),
      consented_at: input.consent === true ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) {
    // a unique violation means another request created this email a moment ago (the caller looks it up again), but a
    // repeated case reference is a defect of ours, not a race: say so instead of pretending the email exists
    if (error.code === '23505' && !/case_ref/.test(`${error.message} ${error.details ?? ''}`)) return null;
    throw new Error(`lead insert failed: ${error.message}`);
  }
  await logActivity(db, { leadId: data.id, code: 'lead_created', text: 'Lead created from the eligibility check', meta: { source: data.source } });
  await enqueueEvent(db, {
    type: 'lead.created',
    leadId: data.id,
    payload: { lead: leadSnapshot(data), answers, utm: data.utm },
    dedupeKey: `lead.created:${data.id}`,
  });
  await startWelcomeSequence(data);
  return data;
}

/**
 * The form of a browser that holds a lead, with another address: a correction of that lead when the name is still the
 * lead's own. A different name is a different person (a spouse on the same computer, who may even share the phone
 * number), who gets a lead of their own.
 */
function isCorrection(lead: LeadRow, input: LeadInput): boolean {
  return capitalizeName(input.fullName).toLowerCase() === lead.full_name.trim().toLowerCase();
}

async function updateLead(db: Db, lead: LeadRow, input: LeadInput): Promise<{ lead: LeadRow; changed: string[] }> {
  const patch: Partial<LeadRow> = {};
  const changed: string[] = [];
  const name = capitalizeName(input.fullName);
  if (name !== lead.full_name) {
    patch.full_name = name;
    changed.push('name');
  }
  if (input.phone !== lead.phone) {
    patch.phone = input.phone;
    changed.push('phone');
  }
  if (input.locale !== lead.locale) {
    patch.locale = input.locale;
    changed.push('locale');
  }
  const answersChanged = answersDiffer(lead.answers, input.answers);
  if (answersChanged) {
    const merged = mergeAnswers(lead.answers, input.answers);
    patch.answers = asJson(merged);
    patch.route = routeFromAnswers(merged);
    changed.push('answers');
  }
  if (input.consent === true && !lead.consented_at) patch.consented_at = new Date().toISOString();
  if (Object.keys(patch).length === 0) return { lead, changed };

  const { data, error } = await db.from('leads').update(patch).eq('id', lead.id).select('*').single();
  if (error || !data) throw new Error(`lead update failed: ${error?.message ?? 'no row'}`);
  if (patch.full_name || patch.phone) await logActivity(db, { leadId: lead.id, code: 'details_updated', text: 'Contact details updated by the applicant' });
  if (answersChanged) await logActivity(db, { leadId: lead.id, code: 'answers_updated', text: 'Eligibility answers updated' });
  return { lead: data, changed };
}

/**
 * The visitor corrected the address of the lead this browser holds. The lead moves to the new address (changeLeadEmail:
 * unverified, every link and cookie issued before dies), what was queued for the old address is cancelled, welcome-1 and
 * the booking confirmation go to the new one, and the firm's CRM is told. Returns null when the address is taken.
 */
async function correctEmail(db: Db, lead: LeadRow, input: LeadInput): Promise<LeadRow | null> {
  const moved = await changeLeadEmail(db, lead, input.email);
  if (!moved) return null;
  const { lead: updated, changed } = await updateLead(db, moved, input);
  // nothing that was queued for the mistyped address may reach it: a booking confirmation carries the name, the phone number
  // and the time of the call (the nurture emails are cancelled by restartForNewAddress; this takes every other kind)
  await cancelPendingEmails(db, lead.id, 'cancelled: the address was corrected', { notTo: updated.email });
  await logActivity(db, {
    leadId: lead.id,
    code: 'email_changed',
    text: 'Email address corrected by the applicant',
    meta: { from: lead.email, to: updated.email },
  });
  await announceUpdate(db, updated, ['email', ...changed], { email: lead.email });
  await restartForNewAddress(updated);
  await resendBookingConfirmation(db, updated);
  return updated;
}

/** The new address gets the confirmation of the call the lead already holds, with links that work for it. */
async function resendBookingConfirmation(db: Db, lead: LeadRow): Promise<void> {
  const booking = await activeBooking(db, lead.id);
  if (!booking || new Date(booking.ends_at).getTime() < Date.now()) return;
  const settings = await loadCallSettings(db);
  await queueEmail({
    template: 'booking-confirmation',
    lead,
    data: {
      startsAt: new Date(booking.starts_at).toISOString(),
      timezone: booking.timezone ?? settings.timezone,
      minutes: Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60_000),
    },
    dedupeKey: `booking-confirmation:${booking.id}:e${lead.session_epoch}`,
  });
}

/**
 * A browser holds one identity. When the lead cookie is (re)issued for a lead and the browser is still signed in as
 * ANOTHER lead (a shared computer), that session is ended, so a later booking can never land on the wrong person.
 * Staff sessions are untouched: staff are not leads.
 */
export async function endForeignSession(db: Db, lead: Pick<LeadRow, 'id'>): Promise<void> {
  const sessionLead = await getSessionLead(db);
  if (sessionLead && sessionLead.id !== lead.id) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut({ scope: 'local' });
  }
}

/** What the "file-open" email shows about the case so far. */
export async function fileOpenData(db: Db, leadId: string) {
  const [application, documents] = await Promise.all([
    db.from('applications').select('completed_at').eq('lead_id', leadId).maybeSingle(),
    db.from('documents').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('status', 'received'),
  ]);
  const applicationState: 'not_started' | 'in_progress' | 'complete' = !application.data
    ? 'not_started'
    : application.data.completed_at
      ? 'complete'
      : 'in_progress';
  return { applicationState, docsReceived: documents.count ?? 0, docsTotal: DOC_TYPES.length };
}

/**
 * Emails the lead the "your file" message with a signed link into the portal. At most one per reason and hour, so a
 * stranger repeating a request can not flood somebody's inbox.
 */
export async function sendFileLink(db: Db, lead: LeadRow, reason: 'returned' | 'result' | 'resend'): Promise<void> {
  await queueEmail({
    template: 'file-open',
    lead,
    data: await fileOpenData(db, lead.id),
    dedupeKey: `file-open:${reason}:${lead.id}:${hourKey()}`,
  });
}

export async function findLeadByEmail(db: Db, email: string): Promise<LeadRow | null> {
  const { data, error } = await db.from('leads').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
  return data;
}

/** GET /api/lead */
export function serializeLead(lead: LeadRow, booking: BookingRow | null): LeadSummary {
  return {
    leadId: lead.id,
    caseRef: lead.case_ref,
    fullName: lead.full_name,
    firstName: firstNameOf(lead.full_name),
    email: lead.email,
    phone: lead.phone,
    locale: lead.locale as Locale,
    route: lead.route,
    answers: cleanAnswers(lead.answers),
    stage: lead.stage,
    status: lead.status,
    accountCreated: !!lead.account_created_at,
    passwordSet: !!lead.password_set_at,
    emailVerified: !!lead.email_verified_at,
    booking: booking ? toBookingSummary(booking) : null,
  };
}
