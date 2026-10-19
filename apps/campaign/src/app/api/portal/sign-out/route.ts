import { mainSiteUrl } from '@dpl/db/env';
import { assertSameOrigin, handle, json } from '@dpl/db/http';
import { clearLeadCookie } from '@dpl/db/lead-session';
import { createServerSupabase } from '@dpl/db/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/sign-out: ends this browser's portal session. The Supabase session is closed for this browser only
 * (the applicant's other devices stay signed in), and the lead cookie is cleared as well: it can open the portal again
 * through POST /api/portal/enter, so leaving it behind would make "Sign out" on a shared computer meaningless.
 * Safe to call without a session.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: 'local' });
  await clearLeadCookie();
  // the firm's site has a lead cookie of its own that this domain cannot reach: the browser goes through it on the way out
  return json({ ok: true, forgetUrl: `${mainSiteUrl().replace(/\/$/, '')}/api/lead/forget` });
});
