import 'server-only';
import type { Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { createResumeToken, readPortalLinkToken, resumeUrl } from '@dpl/db/links';
import { isSameBrowser, markEmailVerified, openPortalSession } from '@dpl/db/portal-session';
import { NextResponse } from 'next/server';
import { isBilingual as bilingual } from '@/lib/bilingual';
import { localizePath } from '@/components/auth/logic/paths';
import { redirectTo } from '@/server/auth';

/** Portal-side names of the funnel steps an emailed link can lead to, and where they live on the firm's site. */
const FUNNEL_STEPS: Record<string, string> = {
  '/booking': '/apply/booking',
  '/offer': '/apply/offer',
  '/details': '/apply/details',
  '/eligibility': '/apply/eligibility',
};

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
    // the link was received at this address: the mailbox is proven (a staff account is still never taken over)
    await openPortalSession(db, verified, { mailboxProven: true });
    // a funnel step ("Book my free call", "Change or cancel") lives on the firm's site, which has no cookie for this
    // browser: hand the verified lead over with a short-lived token instead of redirecting into a page that cannot know us
    const prefix = bilingual() && locale === 'he' ? '/he' : '';
    // Proving the mailbox from a browser that did not create the lead replaces the lead's session epoch (the defence
    // against somebody who registered the address first), which also ends the cookie the firm's site gave THIS owner
    // when they filled in the form: so a plain /portal visit passes through the firm's site once to get a fresh one.
    const renewed = verified.session_epoch !== lead.session_epoch && link.next === '/portal';
    const step = FUNNEL_STEPS[link.next] ?? (renewed ? '/portal' : undefined);
    if (step) {
      const target = `${prefix}${step}`;
      const token = await createResumeToken(verified, target);
      if (token) return NextResponse.redirect(resumeUrl(token), 303);
    }
    return redirectTo(req, localizePath(link.next, locale));
  } catch (e) {
    console.error('[go] could not open the portal from an emailed link', e);
    return expired();
  }
}

export type EmailLinkState = 'expired' | 'confirm' | 'open';

/**
 * What a GET on /go/[token] should do, decided WITHOUT changing anything:
 *  - 'expired': bad, replaced or unknown token;
 *  - 'confirm': the mailbox has not been verified yet and this browser is not the one that created the lead. Opening the
 *    link now would run the pre-registration defence (revoking the password, sessions and cookie that were set up
 *    before). Mail security scanners and link previewers open links with a GET, so that must wait for a person to press
 *    the confirmation button (a POST), otherwise a scanner could log the real applicant out minutes after sign-up;
 *  - 'open': nothing destructive can happen, sign in right away.
 */
export async function inspectEmailLink(token: string): Promise<EmailLinkState> {
  const link = await readPortalLinkToken(token);
  if (!link) return 'expired';
  const db = createAdminSupabase();
  const { data: lead } = await db.from('leads').select('*').eq('id', link.leadId).maybeSingle();
  if (!lead || lead.session_epoch !== link.epoch) return 'expired';
  if (lead.email_verified_at) return 'open';
  return (await isSameBrowser(db, lead)) ? 'open' : 'confirm';
}
