import 'server-only';
import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { readPortalLinkToken } from '@dpl/db/links';
import { isSameBrowser, markEmailVerified, openPortalSession } from '@dpl/db/portal-session';
import type { NextResponse } from 'next/server';
import { localizePath } from '@/components/funnel/logic/paths';
import { redirectTo } from '@/server/auth';

/**
 * The link in every email: /go/[token]. A signed, 60-day token bound to the lead's session epoch. It proves control
 * of the mailbox, so it marks the email verified (see markEmailVerified for what that revokes when the link is
 * opened on a different browser than the one that created the lead), signs this browser in and continues to the
 * path the link was made for. A bad, expired or replaced token lands on a page that offers a fresh link.
 */
export async function openFromEmailLink(req: Request, locale: Locale, token: string): Promise<NextResponse> {
  const expired = () => redirectTo(req, localizePath('/link-expired', locale));

  const link = await readPortalLinkToken(token);
  if (!link) return expired();

  try {
    const db = createAdminSupabase();
    const { data: lead } = await db.from('leads').select('*').eq('id', link.leadId).maybeSingle();
    if (!lead || lead.session_epoch !== link.epoch) return expired();

    const sameBrowser = await isSameBrowser(db, lead);
    const verified = await markEmailVerified(db, lead, { sameBrowser });
    await openPortalSession(db, verified);
    return redirectTo(req, localizePath(link.next, locale));
  } catch (e) {
    console.error('[go] could not open the portal from an emailed link', e);
    return expired();
  }
}
