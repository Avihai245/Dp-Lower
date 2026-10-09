import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow } from '@dpl/db/http';
import { getCookieLead } from '@dpl/db/lead-session';
import { AccountEmailInUse, openPortalSession } from '@dpl/db/portal-session';

export const dynamic = 'force-dynamic';

/**
 * "Go to my portal": signs this browser in as the lead it created, without a password. Only the lead cookie
 * qualifies (it proves this browser created the lead); everybody else enters through an emailed link. When the address
 * already has a sign-in account that is not this lead's own (staff, a hand-made account, someone else's registration) the
 * answer is 409 `account_exists`: the visitor signs in to that account with its password or a reset link instead.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'portal-enter', { windowSeconds: 60, max: 20 });
  const db = createAdminSupabase();
  const lead = await getCookieLead(db);
  if (!lead) throw new ApiError(401, 'unauthorized');
  try {
    await openPortalSession(db, lead);
  } catch (e) {
    if (e instanceof AccountEmailInUse) throw new ApiError(409, 'account_exists');
    throw e;
  }
  return json({ ok: true });
});
