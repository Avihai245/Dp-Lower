import { createAdminSupabase } from '@dpl/db/admin';
import { readResumeToken } from '@dpl/db/links';
import { campaignSiteUrl, siteUrl } from '@dpl/db/env';
import { setLeadCookie } from '@dpl/db/lead-session';
import { claimOnce } from '@dpl/db/single-use';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lead/resume?t=<token>: where the portal's /go/[token] sends a browser whose emailed link led to a step of the
 * funnel ("Book my free call", "Change or cancel"). The funnel and its lead cookie belong to this site, the portal to
 * another domain, so the portal mints a 2-minute `resume` token for the lead whose mailbox it has just proved, and this
 * route turns it into the lead cookie and goes to the step. The destination is signed into the token and limited to the
 * funnel's pages. A token for an old session epoch (the link was replaced) or any bad token starts the funnel over.
 */
export async function GET(req: NextRequest) {
  const origin = siteUrl().replace(/\/$/, '');
  const restart = () => NextResponse.redirect(`${origin}/apply/details`, 303);
  const link = await readResumeToken(req.nextUrl.searchParams.get('t') ?? '');
  if (!link) return restart();
  const db = createAdminSupabase();
  // one use: the address of this redirect may end up in a log or a history, and must not work a second time
  if (!(await claimOnce(db, req.nextUrl.searchParams.get('t') ?? ''))) return restart();
  const { data: lead } = await db.from('leads').select('*').eq('id', link.leadId).maybeSingle();
  if (!lead || lead.session_epoch !== link.epoch) return restart();
  await setLeadCookie(lead);
  // /portal is the portal's own page: the browser was only sent through here so that this site's lead cookie follows the
  // verified owner (it was invalidated when the mailbox was proved); then it goes back
  const home = /^(\/he)?\/portal$/.test(link.target) ? campaignSiteUrl().replace(/\/$/, '') : origin;
  return NextResponse.redirect(`${home}${link.target}`, 303);
}
