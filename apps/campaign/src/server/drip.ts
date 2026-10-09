import 'server-only';
import {
  DOC_TYPES,
  planDrip,
  WELCOME_COUNT,
  welcomeScheduledFor,
  type DripDecision,
  type DripRecord,
} from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import type { Db, LeadRow } from '@dpl/db/types';
import { eventByDedupeKey, queueEmailEvent } from './email';
import type { WelcomeTemplateId } from '@dpl/emails';

/**
 * The 15-email nurture sequence.
 *
 *  - `startWelcomeSequence(lead)` runs right after a lead is created: it queues welcome-1 immediately and records it
 *    in `email_sequence_state`, so the scheduler continues from number 2.
 *  - `scheduleDueEmails(db, now)` runs every few minutes (from /api/cron/dispatch): for every lead it asks `planDrip`
 *    (the rules live in @dpl/core and are unit tested) what is due, queues the emails to send, and records the ones
 *    to skip. It is idempotent: every email has the dedupe key `welcome:{leadId}:{n}` and one state row per number.
 *  - `syncSequenceDelivery(db)` marks state rows 'sent' once the dispatcher has delivered their outbox event.
 */

const WINDOW_DAYS = 47;
const PAGE = 500;
const IN_CHUNK = 100;
const DAY_MS = 86_400_000;

export const welcomeKey = (leadId: string, number: number): string => `welcome:${leadId}:${number}`;
const templateFor = (number: number): WelcomeTemplateId => `welcome-${number}` as WelcomeTemplateId;

/** Queues email `number` for the lead and records it as 'queued'. Returns false when it could not be queued (it is retried by the next run). */
async function queueWelcome(
  db: Db,
  lead: LeadRow,
  number: number,
  scheduledFor: Date,
  now: Date,
): Promise<boolean> {
  const event = await queueEmailEvent({
    template: templateFor(number),
    lead,
    dedupeKey: welcomeKey(lead.id, number),
    at: now,
  });
  const eventId = event?.id ?? (await eventByDedupeKey(db, welcomeKey(lead.id, number)))?.id ?? null;
  if (!eventId) return false;
  const { error } = await db.from('email_sequence_state').upsert(
    {
      lead_id: lead.id,
      number,
      status: 'queued',
      scheduled_for: scheduledFor.toISOString(),
      event_id: eventId,
    },
    { onConflict: 'lead_id,number', ignoreDuplicates: true },
  );
  if (error) {
    console.error('[drip] state upsert failed', lead.id, number, error.message);
    return false;
  }
  return true;
}

/** Called right after a lead is created. Never throws. */
export async function startWelcomeSequence(lead: LeadRow): Promise<void> {
  try {
    if (lead.unsubscribed_at || lead.submitted_at) return;
    await queueWelcome(createAdminSupabase(), lead, 1, new Date(lead.created_at), new Date());
  } catch (e) {
    console.error('[drip] startWelcomeSequence failed', lead.id, e);
  }
}

export interface ScheduleResult {
  /** leads that were looked at */
  leads: number;
  /** emails queued */
  scheduled: number;
  /** emails recorded as skipped (call already booked, documents complete, overdue) */
  skipped: number;
  /** leads whose sequence is over (unsubscribed, submitted, case past the application) */
  stopped: number;
  /** emails that could not be queued; the next run tries again */
  errors: number;
}

const chunks = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

async function candidateLeads(db: Db, now: Date, onlyLeadIds?: string[]): Promise<LeadRow[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();
  const out: LeadRow[] = [];
  const read = async (ids?: string[]): Promise<void> => {
    for (let from = 0; ; from += PAGE) {
      let q = db
        .from('leads')
        .select('*')
        .gte('created_at', since)
        .lte('created_at', now.toISOString())
        .is('unsubscribed_at', null)
        .is('submitted_at', null)
        // people who signed in with Google never asked for an eligibility check: no nurture sequence for them
        .neq('source', 'oauth')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (ids) q = q.in('id', ids);
      const { data, error } = await q;
      if (error) throw new Error(`candidate leads: ${error.message}`);
      out.push(...data);
      if (data.length < PAGE) break;
    }
  };
  if (onlyLeadIds) for (const ids of chunks(onlyLeadIds, IN_CHUNK)) await read(ids);
  else await read();
  return out;
}

/**
 * Decides and queues what is due. `now` is injectable for tests; `onlyLeadIds` restricts the run to some leads
 * (tests, or re-running one case by hand).
 */
export async function scheduleDueEmails(
  db: Db,
  now: Date = new Date(),
  opts: { onlyLeadIds?: string[] } = {},
): Promise<ScheduleResult> {
  const result: ScheduleResult = { leads: 0, scheduled: 0, skipped: 0, stopped: 0, errors: 0 };
  const leads = await candidateLeads(db, now, opts.onlyLeadIds);
  result.leads = leads.length;
  if (leads.length === 0) return result;

  // where each lead is in the sequence
  const recordsOf = new Map<string, DripRecord[]>();
  for (const ids of chunks(
    leads.map((l) => l.id),
    IN_CHUNK,
  )) {
    const { data, error } = await db
      .from('email_sequence_state')
      .select('lead_id, number, status, created_at')
      .in('lead_id', ids);
    if (error) throw new Error(`sequence state: ${error.message}`);
    for (const r of data) {
      const list = recordsOf.get(r.lead_id) ?? [];
      list.push({ number: r.number, status: r.status, sentAt: new Date(r.created_at) });
      recordsOf.set(r.lead_id, list);
    }
  }

  // only the leads that have something due need the booking and document lookups
  const due = leads.filter((lead) => {
    const done = new Set((recordsOf.get(lead.id) ?? []).map((r) => r.number));
    let next = 1;
    while (next <= WELCOME_COUNT && done.has(next)) next++;
    return (
      next <= WELCOME_COUNT && welcomeScheduledFor(new Date(lead.created_at), next).getTime() <= now.getTime()
    );
  });
  if (due.length === 0) return result;

  const booked = new Set<string>();
  const received = new Map<string, number>();
  for (const ids of chunks(
    due.map((l) => l.id),
    IN_CHUNK,
  )) {
    const [bookings, docs] = await Promise.all([
      db.from('bookings').select('lead_id').in('lead_id', ids).in('status', ['confirmed', 'completed']),
      db.from('documents').select('lead_id').in('lead_id', ids).eq('status', 'received'),
    ]);
    if (bookings.error) throw new Error(`bookings: ${bookings.error.message}`);
    if (docs.error) throw new Error(`documents: ${docs.error.message}`);
    for (const b of bookings.data) booked.add(b.lead_id);
    for (const d of docs.data) received.set(d.lead_id, (received.get(d.lead_id) ?? 0) + 1);
  }

  for (const lead of due) {
    const decisions: DripDecision[] = planDrip(
      {
        createdAt: new Date(lead.created_at),
        unsubscribedAt: lead.unsubscribed_at ? new Date(lead.unsubscribed_at) : null,
        submittedAt: lead.submitted_at ? new Date(lead.submitted_at) : null,
        stage: lead.stage,
        hasBooking: booked.has(lead.id),
        docsReceived: received.get(lead.id) ?? 0,
        docsTotal: DOC_TYPES.length,
        route: lead.route,
      },
      recordsOf.get(lead.id) ?? [],
      now,
    );
    for (const d of decisions) {
      if (d.action === 'stop') {
        result.stopped++;
      } else if (d.action === 'skip') {
        const { error } = await db.from('email_sequence_state').upsert(
          {
            lead_id: lead.id,
            number: d.number,
            status: 'skipped',
            reason: d.reason,
            scheduled_for: d.scheduledFor.toISOString(),
          },
          { onConflict: 'lead_id,number', ignoreDuplicates: true },
        );
        if (error) {
          console.error('[drip] skip record failed', lead.id, d.number, error.message);
          result.errors++;
        } else {
          result.skipped++;
        }
      } else if (await queueWelcome(db, lead, d.number, d.scheduledFor, now)) {
        result.scheduled++;
      } else {
        result.errors++;
      }
    }
  }
  return result;
}

/** Marks 'queued' sequence rows as 'sent' once the dispatcher has delivered their event. Returns how many changed. */
export async function syncSequenceDelivery(db: Db): Promise<number> {
  const { data: queued, error } = await db
    .from('email_sequence_state')
    .select('event_id')
    .eq('status', 'queued')
    .not('event_id', 'is', null)
    .limit(1000);
  if (error) throw new Error(`sequence sync: ${error.message}`);
  const ids = queued.map((r) => r.event_id).filter((id): id is string => !!id);
  let changed = 0;
  for (const part of chunks(ids, IN_CHUNK)) {
    const { data: sent } = await db.from('events').select('id').in('id', part).eq('status', 'sent');
    const sentIds = (sent ?? []).map((e) => e.id);
    if (sentIds.length === 0) continue;
    const { data: updated } = await db
      .from('email_sequence_state')
      .update({ status: 'sent' })
      .in('event_id', sentIds)
      .eq('status', 'queued')
      .select('lead_id');
    changed += updated?.length ?? 0;
  }
  return changed;
}
