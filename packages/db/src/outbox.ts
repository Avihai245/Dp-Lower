import 'server-only';
import type { CrmEventType, EmailPayload, LeadSnapshot, Locale } from '@dpl/core';
import { asJson, type Db, type EventRow, type LeadRow } from './types';

export function leadSnapshot(l: LeadRow): LeadSnapshot {
  return {
    id: l.id,
    caseRef: l.case_ref,
    name: l.full_name,
    email: l.email,
    phone: l.phone,
    locale: l.locale as Locale,
    route: l.route,
    source: l.source,
    stage: l.stage,
    status: l.status,
  };
}

interface EnqueueArgs {
  type: CrmEventType;
  leadId?: string | null;
  payload: Record<string, unknown>;
  /** Makes the insert idempotent (e.g. `booking.created:{booking id}`). */
  dedupeKey?: string;
  at?: Date;
}

/** Writes a CRM event to the outbox. The dispatcher delivers it to Zapier. Never throws: a failed CRM write must not break a visitor's request. */
export async function enqueueEvent(db: Db, a: EnqueueArgs): Promise<void> {
  const row = {
    type: a.type,
    channel: 'crm' as const,
    lead_id: a.leadId ?? null,
    payload: asJson(a.payload),
    dedupe_key: a.dedupeKey ?? null,
    next_attempt_at: (a.at ?? new Date()).toISOString(),
  };
  const q = a.dedupeKey
    ? db.from('events').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    : db.from('events').insert(row);
  const { error } = await q;
  if (error) console.error('[outbox] enqueueEvent failed', a.type, error.message);
}

/** Queues a rendered email. Returns the event row, or null when the dedupe key already exists. */
export async function enqueueEmail(
  db: Db,
  a: { leadId: string | null; payload: EmailPayload; dedupeKey: string; at?: Date },
): Promise<EventRow | null> {
  const { data, error } = await db
    .from('events')
    .upsert(
      {
        type: 'email.send',
        channel: 'email' as const,
        lead_id: a.leadId,
        payload: asJson(a.payload),
        dedupe_key: a.dedupeKey,
        next_attempt_at: (a.at ?? new Date()).toISOString(),
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (error) {
    console.error('[outbox] enqueueEmail failed', a.payload.template, error.message);
    return null;
  }
  return data;
}

interface ActivityArgs {
  leadId: string;
  text: string;
  kind?: 'system' | 'staff';
  code?: string;
  actor?: { id: string; name: string } | null;
  meta?: Record<string, unknown>;
}

/** Appends to the documented history of a case (shown as "Activity" in the CRM). */
export async function logActivity(db: Db, a: ActivityArgs): Promise<void> {
  const { error } = await db.from('activity_log').insert({
    lead_id: a.leadId,
    kind: a.kind ?? 'system',
    code: a.code ?? null,
    text: a.text,
    actor_id: a.actor?.id ?? null,
    actor_name: a.actor?.name ?? null,
    meta: asJson(a.meta ?? {}),
  });
  if (error) console.error('[activity] insert failed', error.message);
}

/**
 * Nurture emails that are queued but not yet delivered stop with the sequence: the person unsubscribed or submitted, or the
 * address was corrected. (The dispatcher checks again at delivery, so an email claimed in the same moment is still caught.)
 * An email already handed to the sending app cannot be recalled.
 */
export async function cancelPendingNurture(db: Db, leadId: string, reason: string): Promise<void> {
  const { error } = await db
    .from('events')
    .update({ status: 'cancelled', last_error: reason, locked_at: null })
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .in('status', ['pending', 'failed'])
    .eq('payload->>category', 'nurture');
  if (error) console.error('[outbox] cancelPendingNurture failed', error.message);
}
