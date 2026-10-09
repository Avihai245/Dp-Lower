import 'server-only';
import { DOC_TYPES, capitalizeName, firstNameOf, routeFromAnswers, type LeadInput, type Locale } from '@dpl/core';
import { getSessionLead } from '@dpl/db/lead-session';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import { isSameBrowser } from '@dpl/db/portal-session';
import { createServerSupabase } from '@dpl/db/server';
import { asJson, type BookingRow, type Db, type LeadRow } from '@dpl/db/types';
import { cookies } from 'next/headers';
import { answersDiffer, cleanAnswers, mergeAnswers } from '@/components/funnel/logic/answers';
import type { LeadSummary } from '@/components/funnel/logic/api-types';
import { parseFirstTouch, SRC_COOKIE, UTM_COOKIE, type FirstTouch } from '@/components/funnel/logic/first-touch';
import { toBookingSummary } from '@/server/bookings';
import { startWelcomeSequence } from '@/server/drip';
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

/**
 * The three-way rule of docs/ARCHITECTURE.md section 7:
 *  - new email: a new lead (lead cookie for this browser, `lead.created`, welcome sequence);
 *  - known email from the browser that created it (cookie) or one signed in as it: update name, phone, answers;
 *  - known email from anywhere else: change NOTHING, email the address owner a link to their file.
 * The caller sets the lead cookie for `created` / `updated`.
 */
export async function submitLead(db: Db, input: LeadInput, firstTouch: FirstTouch): Promise<LeadOutcome> {
  const { data: found, error } = await db.from('leads').select('*').eq('email', input.email).maybeSingle();
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
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
  if (await isSameBrowser(db, lead)) return { status: 'updated', lead: await updateLead(db, lead, input) };
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

async function updateLead(db: Db, lead: LeadRow, input: LeadInput): Promise<LeadRow> {
  const patch: Partial<LeadRow> = {};
  const name = capitalizeName(input.fullName);
  if (name !== lead.full_name) patch.full_name = name;
  if (input.phone !== lead.phone) patch.phone = input.phone;
  if (input.locale !== lead.locale) patch.locale = input.locale;
  const answersChanged = answersDiffer(lead.answers, input.answers);
  if (answersChanged) {
    const merged = mergeAnswers(lead.answers, input.answers);
    patch.answers = asJson(merged);
    patch.route = routeFromAnswers(merged);
  }
  if (input.consent === true && !lead.consented_at) patch.consented_at = new Date().toISOString();
  if (Object.keys(patch).length === 0) return lead;

  const { data, error } = await db.from('leads').update(patch).eq('id', lead.id).select('*').single();
  if (error || !data) throw new Error(`lead update failed: ${error?.message ?? 'no row'}`);
  if (patch.full_name || patch.phone) await logActivity(db, { leadId: lead.id, code: 'details_updated', text: 'Contact details updated by the applicant' });
  if (answersChanged) await logActivity(db, { leadId: lead.id, code: 'answers_updated', text: 'Eligibility answers updated' });
  return data;
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
