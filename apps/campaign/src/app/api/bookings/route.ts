import { bookingInputSchema } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow, parseJson } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { bookCall, cancelBooking, toBookingSummary } from '@/server/bookings';

export const dynamic = 'force-dynamic';

/**
 * Books (or moves) the caller's free call. The lead is derived from the lead cookie / session, never from the body.
 * 409 slot_unavailable covers a taken, blocked, unknown or too-soon slot.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'bookings', { windowSeconds: 60, max: 20 });
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  const input = await parseJson(req, bookingInputSchema);
  const { booking, created } = await bookCall(db, who.lead, input);
  return json({ booking: toBookingSummary(booking) }, { status: created ? 201 : 200 });
});

export const DELETE = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'bookings', { windowSeconds: 60, max: 20 });
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  await cancelBooking(db, who.lead);
  return json({ ok: true });
});
