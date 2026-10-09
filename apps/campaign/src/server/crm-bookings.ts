import 'server-only';
import { enqueueEvent, leadSnapshot, logActivity } from '@dpl/db/outbox';
import type { Db } from '@dpl/db/types';
import type { ActionResult, CallStatus } from '@/components/admin/types';
import { firmText, lawyerOf, recordCancellation, toBookingSummary } from './bookings';
import { loadCallSettings } from './availability';
import { done, fail, getLead } from './crm-util';
import type { StaffSession } from './staff';

/**
 * What the team does with a booked call from the lead's page (Server Actions, any member of staff):
 *  - "Mark call held" (completed) and "Mark no-show" once the call has started; each corrects the other, and a call the
 *    dispatcher recorded as held a day later can still be marked a no-show;
 *  - "Cancel call" while it is still ahead: the applicant gets the booking-cancelled email, the CRM a booking.cancelled
 *    event (reason 'staff').
 * A no-show sends nothing to the applicant; it emits booking.no_show so the firm's CRM can follow up (and booking.held when staff correct it).
 * Every change is a conditional update (the state the button was shown for), so two people clicking at once, or a call
 * that changed meanwhile, end in 'conflict' rather than a double email.
 */

export type CallActionKind = 'held' | 'no_show' | 'cancel';

type Actor = StaffSession['actor'];

const TO: Record<'held' | 'no_show', { to: CallStatus; from: CallStatus[]; code: string; text: string }> = {
  held: {
    to: 'completed',
    from: ['confirmed', 'no_show'],
    code: 'booking_held',
    text: 'Marked the call as held',
  },
  no_show: {
    to: 'no_show',
    from: ['confirmed', 'completed'],
    code: 'booking_no_show',
    text: 'Marked the call as a no-show',
  },
};

export async function callAction(
  db: Db,
  actor: Actor,
  a: { leadId: string; bookingId: string; action: CallActionKind },
  now: Date = new Date(),
): Promise<ActionResult<{ status: CallStatus | 'cancelled' }>> {
  const lead = await getLead(db, a.leadId);
  if (!lead) return fail('not_found');
  const { data: booking } = await db
    .from('bookings')
    .select('*')
    .eq('id', a.bookingId)
    .eq('lead_id', a.leadId)
    .maybeSingle();
  if (!booking) return fail('not_found');
  const at = now.toISOString();

  if (a.action === 'cancel') {
    if (booking.status === 'cancelled') return done({ status: 'cancelled' });
    const { data, error } = await db
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: at })
      .eq('id', booking.id)
      .eq('status', 'confirmed')
      .gt('ends_at', at)
      .select('*')
      .maybeSingle();
    if (error) return fail('internal');
    if (!data) return fail('conflict');
    await recordCancellation(db, lead, data, { kind: 'staff', actor });
    return done({ status: 'cancelled' });
  }

  const step = TO[a.action];
  if (booking.status === step.to) return done({ status: step.to });
  const { data, error } = await db
    .from('bookings')
    .update({ status: step.to })
    .eq('id', booking.id)
    .in('status', step.from)
    .lte('starts_at', at)
    .select('*')
    .maybeSingle();
  if (error) return fail('internal');
  if (!data) return fail('conflict');

  const settings = await loadCallSettings(db);
  const summary = toBookingSummary(data);
  await logActivity(db, {
    leadId: lead.id,
    kind: 'staff',
    actor,
    code: step.code,
    text: `${step.text} (${firmText(data.starts_at, settings.timezone)})`,
    meta: { bookingId: data.id, startsAt: summary.startsAt, from: booking.status },
  });
  if (a.action === 'no_show' || (a.action === 'held' && booking.status === 'no_show')) {
    const noShow = a.action === 'no_show';
    const type = noShow ? 'booking.no_show' : 'booking.held';
    await enqueueEvent(db, {
      type,
      leadId: lead.id,
      payload: {
        lead: leadSnapshot(lead),
        booking: { ...summary, lawyer: await lawyerOf(db, data.assigned_to) },
        by: actor.name,
      },
      // the first marking of a call has a fixed key; a correction (no-show, held, no-show again) is a new fact for the CRM
      dedupeKey: noShow && booking.status !== 'completed' ? `booking.no_show:${data.id}` : `${type}:${data.id}:${at}`,
    });
  }
  return done({ status: step.to });
}
