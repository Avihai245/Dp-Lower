import { createAdminSupabase } from '@dpl/db/admin';
import { safeNext } from '@dpl/db/links';
import { getCookieLead, setLeadCookie } from '@dpl/db/lead-session';
import { ensureLeadForUser, markAccountCreated, markEmailVerified, openPortalSession } from '@dpl/db/portal-session';
import { createServerSupabase } from '@dpl/db/server';
import type { Locale } from '@dpl/core';
import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { localizePath } from '@/components/funnel/logic/paths';
import { isSameOriginRequest, isStaffUser, leadExistsForUser, localeOf, redirectTo } from '@/server/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ locale: string }> };

/** The only emailed token this app puts into a link is the password reset; anything else is refused. */
const isRecovery = (v: string | null): v is 'recovery' => v === 'recovery';

const failure = (req: NextRequest, locale: Locale, error: 'link' | 'oauth') =>
  redirectTo(req, localizePath(`/sign-in?error=${error}`, locale));

type Credential = { code: string } | { tokenHash: string };

/**
 * Establishes a Supabase session from a credential, then for applicants finds or creates the lead for that user and
 * marks the mailbox verified (Google and the reset link both prove control of it) and the lead as having an account (a lead
 * that existed before this sign-in reaches "Account created" here, not on its first application save). When that happens in a browser
 * that did not create the lead, markEmailVerified revokes whatever was set up before, including the session that was
 * just created, so a fresh one is opened afterwards. Staff go to /admin unless a `next` says otherwise.
 */
async function finish(req: NextRequest, locale: Locale, credential: Credential, nextGiven: string | null) {
  const db = createAdminSupabase();
  // who is this browser BEFORE the new session exists: the creator of a lead (cookie) or already signed in as it
  const cookieLead = await getCookieLead(db);
  const supabase = await createServerSupabase();
  const {
    data: { user: before },
  } = await supabase.auth.getUser();

  let user: User | null = null;
  if ('code' in credential) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(credential.code);
    if (error) return failure(req, locale, 'oauth');
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: credential.tokenHash, type: 'recovery' });
    if (error) return failure(req, locale, 'link');
    user = data.user;
  }
  if (!user) return failure(req, locale, 'link');

  try {
    if (await isStaffUser(db, user.id)) {
      return redirectTo(req, localizePath(nextGiven ? safeNext(nextGiven, '/admin') : '/admin', locale));
    }

    // a lead created by this very sign-in has nothing to be defended against: there was no earlier registration
    const existed = await leadExistsForUser(db, user);
    const lead = await ensureLeadForUser(db, user, locale);
    const sameBrowser = !existed || cookieLead?.id === lead.id || (!!before && before.id === lead.user_id);
    const verified = await markEmailVerified(db, lead, { sameBrowser });
    // this sign-in is the applicant's account: the lead reaches "Account created" however they got here
    const account = await markAccountCreated(db, verified);
    if (account.session_epoch !== lead.session_epoch) await openPortalSession(db, account);
    else await setLeadCookie(account);
    return redirectTo(req, localizePath(safeNext(nextGiven, '/portal'), locale));
  } catch (e) {
    console.error('[auth/callback] could not finish the sign-in', e);
    return failure(req, locale, 'link');
  }
}

/**
 * Where the auth server sends people back to:
 *  - `?code=` after "Continue with Google" (PKCE code exchange; only the browser that started the flow holds the verifier);
 *  - `?token_hash=&type=recovery` from the password-reset email. That token is single-use and mail security scanners
 *    open links with a GET, so a GET only forwards to the confirmation page (/open-link); the token is used up by the POST
 *    of its button.
 *
 * Served under /[locale] because the intl middleware rewrites every unprefixed path to the default locale:
 * /auth/callback (English) and /he/auth/callback both reach this handler.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const locale = localeOf((await params).locale);
  const q = req.nextUrl.searchParams;
  if (q.get('error')) return failure(req, locale, 'oauth');

  const code = q.get('code');
  if (code) return finish(req, locale, { code }, q.get('next'));

  const tokenHash = q.get('token_hash');
  if (tokenHash && isRecovery(q.get('type'))) {
    const next = q.get('next');
    const target = `/open-link?r=${encodeURIComponent(tokenHash)}${next ? `&next=${encodeURIComponent(safeNext(next, '/portal'))}` : ''}`;
    return redirectTo(req, localizePath(target, locale));
  }
  return failure(req, locale, 'link');
}

/** The confirmation button of /open-link for a password-reset link. */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isSameOriginRequest(req)) return new Response('Forbidden', { status: 403 });
  const locale = localeOf((await params).locale);
  const form = await req.formData().catch(() => null);
  const tokenHash = String(form?.get('token_hash') ?? '');
  if (!tokenHash || !isRecovery(String(form?.get('type') ?? ''))) return failure(req, locale, 'link');
  const next = form?.get('next');
  return finish(req, locale, { tokenHash }, typeof next === 'string' && next ? next : null);
}

/** A HEAD probe (link checkers) must not use up the one-time reset token. */
export function HEAD() {
  return new Response(null, { status: 200 });
}
