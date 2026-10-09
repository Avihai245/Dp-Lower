import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, handle, json } from '@dpl/db/http';
import { resolveLead } from '@dpl/db/lead-session';
import { activeBooking } from '@/server/bookings';
import { serializeLead } from '@/server/leads';

export const dynamic = 'force-dynamic';

/** The caller's own file (lead cookie or signed-in user): what the funnel screens and the set-password screen need. */
export const GET = handle(async () => {
  const db = createAdminSupabase();
  const who = await resolveLead(db);
  if (!who) throw new ApiError(401, 'unauthorized');
  const booking = await activeBooking(db, who.lead.id);
  return json(serializeLead(who.lead, booking), { headers: { 'cache-control': 'no-store' } });
});
