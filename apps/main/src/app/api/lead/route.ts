import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, handle, json, limitOrThrow } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { activeBooking } from '@dpl/db/bookings';
import { serializeLead } from '@dpl/db/leads';

export const dynamic = 'force-dynamic';

/** The caller's own file (lead cookie or signed-in user): what the funnel screens need. */
export const GET = handle(async (req) => {
  await limitOrThrow(req, 'lead-read', { windowSeconds: 60, max: 300 });
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  const booking = await activeBooking(db, who.lead.id);
  return json(serializeLead(who.lead, booking), { headers: { 'cache-control': 'no-store' } });
});
