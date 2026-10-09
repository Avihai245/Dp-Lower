import { createAdminSupabase } from '@dpl/db/admin';
import { handle, json } from '@dpl/db/http';
import { loadAvailability } from '@/server/availability';

export const dynamic = 'force-dynamic';

/**
 * The next bookable days (5 by default) with their free slots, computed from the weekly template, blocked days and
 * confirmed bookings. Public: it contains no personal data. Never cached, a taken slot must disappear at once.
 */
export const GET = handle(async () => {
  const availability = await loadAvailability(createAdminSupabase());
  return json(availability, { headers: { 'cache-control': 'no-store' } });
});
