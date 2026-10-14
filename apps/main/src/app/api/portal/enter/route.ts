import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError, assertSameOrigin, handle, json, limitOrThrow } from '@dpl/db/http';
import { getCookieLead } from '@dpl/db/lead-session';
import { createEnterToken, enterUrl } from '@dpl/db/links';

export const dynamic = 'force-dynamic';

/**
 * "Go to my portal", from the eligibility funnel on this site. The portal itself — sign-in, the application, staff
 * admin — stays on the campaign's own domain, so this request cannot sign the browser in directly (its cookies don't
 * reach there): it only proves "this browser created this lead" (the lead cookie) and mints a short-lived,
 * single-purpose token the client then follows with a full-page navigation to /enter/[token] on that domain, which
 * opens the real session. See packages/db/src/links.ts (createEnterToken) and the campaign app's enter/[token] route.
 */
export const POST = handle(async (req) => {
  assertSameOrigin(req);
  await limitOrThrow(req, 'portal-enter', { windowSeconds: 60, max: 20 });
  const db = createAdminSupabase();
  const lead = await getCookieLead(db);
  if (!lead) throw new ApiError(401, 'unauthorized');
  const token = await createEnterToken(lead);
  return json({ url: enterUrl(token, lead.locale as Locale) });
});
