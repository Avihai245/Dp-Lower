import { createAdminSupabase } from '@dpl/db/admin';
import { safeNext } from '@dpl/db/links';
import { getCookieLead, setLeadCookie } from '@dpl/db/lead-session';
import { ensureLeadForUser, markEmailVerified, openPortalSession } from '@dpl/db/portal-session';
import { createServerSupabase } from '@dpl/db/server';
import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { localizePath } from '@/components/funnel/logic/paths';
import { isStaffUser, leadExistsForUser, localeOf, redirectTo } from '@/server/auth';

export const dynamic = 'force-dynamic';

/** The only emailed token this app puts into a link is the password reset; anything else is refused. */
const isRecovery = (v: string | null): v is 'recovery' => v === 'recovery';

/**
 * Where the auth server sends people back to:
 *  - `?code=` after "Continue with Google" (PKCE code exchange),
 *  - `?token_hash=&type=recovery` from the password-reset email.
 * Both establish a Supabase session. Then, for applicants, the lead for that user is found or created and the
 * mailbox is marked verified (Google and the reset link both prove control of it). When that happens in a browser
 * that did not create the lead, markEmailVerified revokes whatever was set up before, including the session that was
 * just created, so a fresh one is opened afterwards. Staff go to /admin unless a `next` says otherwise.
 *
 * Served under /[locale] because the intl middleware rewrites every unprefixed path to the default locale:
 * /auth/callback (English) and /he/auth/callback both reach this handler.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  const q = req.nextUrl.searchParams;
  const failure = (error: 'link' | 'oauth') => redirectTo(req, localizePath(`/sign-in?error=${error}`, locale));
  if (q.get('error')) return failure('oauth');

  const db = createAdminSupabase();
  // who is this browser BEFORE the new session exists: the creator of a lead (cookie) or already signed in as it
  const cookieLead = await getCookieLead(db);
  const supabase = await createServerSupabase();
  const {
    data: { user: before },
  } = await supabase.auth.getUser();

  const code = q.get('code');
  const tokenHash = q.get('token_hash');
  const type = q.get('type');
  let user: User | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure('oauth');
    user = data.user;
  } else if (tokenHash && isRecovery(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failure('link');
    user = data.user;
  } else {
    return failure('link');
  }
  if (!user) return failure('link');

  try {
    const nextGiven = q.get('next');
    if (await isStaffUser(db, user.id)) {
      return redirectTo(req, localizePath(nextGiven ? safeNext(nextGiven, '/admin') : '/admin', locale));
    }

    // a lead created by this very sign-in has nothing to be defended against: there was no earlier registration
    const existed = await leadExistsForUser(db, user);
    const lead = await ensureLeadForUser(db, user, locale);
    const sameBrowser = !existed || cookieLead?.id === lead.id || (!!before && before.id === lead.user_id);
    const verified = await markEmailVerified(db, lead, { sameBrowser });
    if (verified.session_epoch !== lead.session_epoch) await openPortalSession(db, verified);
    else await setLeadCookie(verified);
    return redirectTo(req, localizePath(safeNext(nextGiven, '/portal'), locale));
  } catch (e) {
    console.error('[auth/callback] could not finish the sign-in', e);
    return failure('link');
  }
}

/** A HEAD probe (link checkers) must not use up the one-time reset token. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
