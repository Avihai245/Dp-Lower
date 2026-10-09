import 'server-only';
import type { BookingInput } from '@dpl/core';
import { ApiError } from '@dpl/db/http';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { BookingRow, Db, LeadRow } from '@dpl/db/types';
import type { BookingSummary } from '@/components/funnel/logic/api-types';
import { loadCallSettings } from './availability';
import { queueEmail } from './email';

export function toBookingSummary(b: BookingRow): BookingSummary {
  return {
    id: b.id,
    startsAt: new Date(b.starts_at).toISOString(),
    endsAt: new Date(b.ends_at).toISOString(),
    timezone: b.timezone,
  };
}

/**
 * The lead's upcoming call: confirmed and not over yet (at most one is confirmed at a time: a partial unique index
 * guarantees it). A confirmed call whose end has passed is not upcoming: it was held unless the team says otherwise, and
 * the dispatcher records it as held a day later (completePastBookings).
 */
export async function activeBooking(db: Db, leadId: string, now: Date = new Date()): Promise<BookingRow | null> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'confirmed')
    .gt('ends_at', now.toISOString())
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bookings query failed: ${error.message}`);
  return data;
}

/** The lawyer a call is assigned to, as the outbox and the emails name them. */
export interface CallLawyer {
  id: string;
  name: string;
  email: string;
}

export async function lawyerOf(db: Db, staffId: string | null): Promise<CallLawyer | null> {
  if (!staffId) return null;
  const { data } = await db.from('staff').select('user_id, full_name, email').eq('user_id', staffId).maybeSingle();
  return data ? { id: data.user_id, name: data.full_name, email: data.email } : null;
}

const SLOT_ERRORS = ['slot_too_soon', 'slot_unavailable', 'slot_full'] as const;

/** "Sunday 11 October 2026 at 12:00" in the firm's zone: the English text of the activity log. */
export function firmText(startsAt: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(startsAt));
}

export interface BookResult {
  booking: BookingRow;
  /** false when the visitor asked for the slot they already hold (nothing changed, nothing is re-sent) */
  created: boolean;
}

/**
 * Books (or moves) the lead's free call. The `book_slot` function validates the slot against the weekly hours (each
 * lawyer's and the unassigned template), the blocked days and the free seats under a per-slot lock, assigns the call to
 * a free lawyer (or a template seat) and replaces the lead's previous booking, so two visitors can never take the same
 * last seat and a lawyer never holds two calls at once. Every slot_* failure is reported as 409 slot_unavailable.
 */
export async function bookCall(db: Db, lead: LeadRow, input: BookingInput): Promise<BookResult> {
  const startsAt = new Date(input.startsAt);
  const previous = await activeBooking(db, lead.id);
  if (previous && new Date(previous.starts_at).getTime() === startsAt.getTime()) return { booking: previous, created: false };

  const { data, error } = await db.rpc('book_slot', { p_lead: lead.id, p_starts: startsAt.toISOString(), p_tz: input.timezone });
  if (error || !data) {
    const reason = SLOT_ERRORS.find((code) => error?.message?.includes(code));
    if (reason) throw new ApiError(409, 'slot_unavailable', { reason });
    // two requests for the same lead raced for the one active booking each lead may hold: the other one won
    if (error?.code === '23505') throw new ApiError(409, 'conflict');
    throw new Error(`book_slot failed: ${error?.message ?? 'no row returned'}`);
  }
  const booking = data;
  const summary = toBookingSummary(booking);
  const [settings, lawyer] = await Promise.all([loadCallSettings(db), lawyerOf(db, booking.assigned_to)]);
  const minutes = Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60_000);
  const snapshot = leadSnapshot(lead);

  if (previous) {
    await enqueueEvent(db, {
      type: 'booking.cancelled',
      leadId: lead.id,
      payload: { lead: snapshot, booking: toBookingSummary(previous), reason: 'rescheduled' },
      dedupeKey: `booking.cancelled:${previous.id}`,
    });
    await logActivity(db, {
      leadId: lead.id,
      code: 'booking_rescheduled',
      text: `Moved the free call from ${firmText(previous.starts_at, settings.timezone)}`,
      meta: { bookingId: previous.id, startsAt: new Date(previous.starts_at).toISOString() },
    });
  }
  await enqueueEvent(db, {
    type: 'booking.created',
    leadId: lead.id,
    payload: { lead: snapshot, booking: { ...summary, minutes, lawyer } },
    dedupeKey: `booking.created:${booking.id}`,
  });
  await logActivity(db, {
    leadId: lead.id,
    code: 'booking_created',
    text: `Booked a free ${minutes}-minute call for ${firmText(booking.starts_at, settings.timezone)} (${settings.timezone})${lawyer ? ` with ${lawyer.name}` : ''}`,
    meta: { bookingId: booking.id, startsAt: summary.startsAt, timezone: booking.timezone, lawyerId: lawyer?.id ?? null },
  });
  await queueEmail({
    template: 'booking-confirmation',
    lead,
    data: {
      startsAt: summary.startsAt,
      timezone: booking.timezone ?? settings.timezone,
      minutes,
      ...(lawyer ? { lawyer: lawyer.name } : {}),
    },
    dedupeKey: `booking-confirmation:${booking.id}`,
  });
  return { booking, created: true };
}

/** Who cancelled: the applicant (funnel / emailed link) or the firm (CRM). */
export type CancelledBy = { kind: 'applicant' } | { kind: 'staff'; actor: { id: string; name: string } };

/**
 * Everything a cancelled call leaves behind: the `booking.cancelled` event, an activity line and the booking-cancelled
 * email to the applicant. Keyed by the booking, so a retried request never sends twice.
 */
export async function recordCancellation(db: Db, lead: LeadRow, booking: BookingRow, by: CancelledBy): Promise<void> {
  const settings = await loadCallSettings(db);
  const summary = toBookingSummary(booking);
  await enqueueEvent(db, {
    type: 'booking.cancelled',
    leadId: lead.id,
    payload: {
      lead: leadSnapshot(lead),
      booking: summary,
      reason: by.kind === 'staff' ? 'staff' : 'cancelled',
      ...(by.kind === 'staff' ? { by: by.actor.name } : {}),
    },
    dedupeKey: `booking.cancelled:${booking.id}`,
  });
  await logActivity(db, {
    leadId: lead.id,
    code: 'booking_cancelled',
    text: `${by.kind === 'staff' ? 'Cancelled the free call (by the firm)' : 'Cancelled the free call'} for ${firmText(booking.starts_at, settings.timezone)}`,
    meta: { bookingId: booking.id, startsAt: summary.startsAt, ...(by.kind === 'staff' ? { by: 'staff' } : {}) },
    ...(by.kind === 'staff' ? { kind: 'staff' as const, actor: by.actor } : {}),
  });
  await queueEmail({
    template: 'booking-cancelled',
    lead,
    data: { startsAt: summary.startsAt, timezone: booking.timezone ?? settings.timezone },
    dedupeKey: `booking-cancelled:${booking.id}`,
  });
}

/** Cancels the lead's upcoming call (the funnel's "Cancel this call"). 404 when there is none. */
export async function cancelBooking(db: Db, lead: LeadRow, now: Date = new Date()): Promise<BookingRow> {
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: now.toISOString() })
    .eq('lead_id', lead.id)
    .eq('status', 'confirmed')
    .gt('ends_at', now.toISOString())
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`cancel booking failed: ${error.message}`);
  if (!data) throw new ApiError(404, 'not_found');
  await recordCancellation(db, lead, data, { kind: 'applicant' });
  return data;
}

/** A call is recorded as held when nobody marked it within this long after its end (the team marks a no-show sooner). */
export const HELD_AFTER_HOURS = 24;

/**
 * The dispatcher's clean-up: confirmed calls that ended more than HELD_AFTER_HOURS ago become 'completed', with one
 * activity line each ("Call date passed; marked as held"). Atomic and idempotent (the database function claims the
 * rows with skip locked). Returns how many calls were marked.
 */
export async function completePastBookings(db: Db, now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - HELD_AFTER_HOURS * 3_600_000).toISOString();
  const { data, error } = await db.rpc('complete_past_bookings', { p_before: before });
  if (error) throw new Error(`complete_past_bookings failed: ${error.message}`);
  return data ?? 0;
}
