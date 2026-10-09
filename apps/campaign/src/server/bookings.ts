import 'server-only';
import type { BookingInput } from '@dpl/core';
import { ApiError } from '@dpl/db/http';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { BookingRow, Db, LeadRow } from '@dpl/db/types';
import type { BookingSummary } from '@/components/funnel/logic/api-types';
import { loadCallSettings } from '@/server/availability';
import { queueEmail } from '@/server/email';

export function toBookingSummary(b: BookingRow): BookingSummary {
  return {
    id: b.id,
    startsAt: new Date(b.starts_at).toISOString(),
    endsAt: new Date(b.ends_at).toISOString(),
    timezone: b.timezone,
  };
}

/** The lead's upcoming call (at most one is confirmed at a time: a partial unique index guarantees it). */
export async function activeBooking(db: Db, leadId: string): Promise<BookingRow | null> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'confirmed')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bookings query failed: ${error.message}`);
  return data;
}

const SLOT_ERRORS = ['slot_too_soon', 'slot_unavailable', 'slot_full'] as const;

/** "Sunday 11 October 2026 at 12:00" in the firm's zone: the English text of the activity log. */
function firmText(startsAt: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(startsAt));
}

export interface BookResult {
  booking: BookingRow;
  /** false when the visitor asked for the slot they already hold (nothing changed, nothing is re-sent) */
  created: boolean;
}

/**
 * Books (or moves) the lead's free call. The `book_slot` function validates the slot against the weekly template,
 * the blocked days and the capacity under a per-slot lock and replaces the lead's previous booking, so two visitors
 * can never take the same last seat. Every slot_* failure is reported as 409 slot_unavailable.
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
  const settings = await loadCallSettings(db);
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
    payload: { lead: snapshot, booking: { ...summary, minutes } },
    dedupeKey: `booking.created:${booking.id}`,
  });
  await logActivity(db, {
    leadId: lead.id,
    code: 'booking_created',
    text: `Booked a free ${minutes}-minute call for ${firmText(booking.starts_at, settings.timezone)} (${settings.timezone})`,
    meta: { bookingId: booking.id, startsAt: summary.startsAt, timezone: booking.timezone },
  });
  await queueEmail({
    template: 'booking-confirmation',
    lead,
    data: { startsAt: summary.startsAt, timezone: booking.timezone ?? settings.timezone, minutes },
    dedupeKey: `booking-confirmation:${booking.id}`,
  });
  return { booking, created: true };
}

/** Cancels the lead's upcoming call. 404 when there is none. */
export async function cancelBooking(db: Db, lead: LeadRow): Promise<BookingRow> {
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('lead_id', lead.id)
    .eq('status', 'confirmed')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`cancel booking failed: ${error.message}`);
  if (!data) throw new ApiError(404, 'not_found');

  const settings = await loadCallSettings(db);
  const summary = toBookingSummary(data);
  await enqueueEvent(db, {
    type: 'booking.cancelled',
    leadId: lead.id,
    payload: { lead: leadSnapshot(lead), booking: summary, reason: 'cancelled' },
    dedupeKey: `booking.cancelled:${data.id}`,
  });
  await logActivity(db, {
    leadId: lead.id,
    code: 'booking_cancelled',
    text: `Cancelled the free call for ${firmText(data.starts_at, settings.timezone)}`,
    meta: { bookingId: data.id, startsAt: summary.startsAt },
  });
  await queueEmail({
    template: 'booking-cancelled',
    lead,
    data: { startsAt: summary.startsAt, timezone: data.timezone ?? settings.timezone },
    dedupeKey: `booking-cancelled:${data.id}`,
  });
  return data;
}
