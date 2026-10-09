import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow } from '@dpl/db/http';
import { getCookieLead } from '@dpl/db/lead-session';
import { openPortalSession } from '@dpl/db/portal-session';

export const dynamic = 'force-dynamic';

/**
 * "Go to my portal": signs this browser in as the lead it created, without a password. Only the lead cookie
 * qualifies (it proves this browser created the lead); everybody else enters through an emailed link.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'portal-enter', { windowSeconds: 60, max: 20 });
  const db = createAdminSupabase();
  const lead = await getCookieLead(db);
  if (!lead) throw new ApiError(401, 'unauthorized');
  await openPortalSession(db, lead);
  return json({ ok: true });
});
