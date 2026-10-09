import 'server-only';
import { DEFAULT_LOCALE, isLocale, type EmailPayload, type Locale } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { campaignUrl } from '@dpl/db/links';
import { enqueueEmail } from '@dpl/db/outbox';
import { ensureAuthUser } from '@dpl/db/portal-session';
import { createServerSupabase } from '@dpl/db/server';
import { rateLimit } from '@dpl/db/rate-limit';
import type { Db } from '@dpl/db/types';
import { renderEmail, type EmailContext } from '@dpl/emails';
import { NextResponse } from 'next/server';
import { queueEmail } from '@/server/email';
import { findLeadByEmail, sendFileLink } from '@/server/leads';

export const localeOf = (raw: string | null | undefined): Locale => (isLocale(raw) ? raw : DEFAULT_LOCALE);

/**
 * The origin the visitor used, for redirects: behind a proxy the request URL can carry an internal host, so the
 * forwarded headers win (the same rule assertSameOrigin applies).
 */
export function publicOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return new URL(req.url).origin;
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? new URL(req.url).protocol.replace(':', '');
  return `${proto}://${host}`;
}

/** A redirect to an app path (already localised) on the visitor's own origin. Never takes a user-supplied URL. */
export const redirectTo = (req: Request, path: string, status: 302 | 303 | 307 = 303): NextResponse =>
  NextResponse.redirect(new URL(path, publicOrigin(req)), status);

/** The CRM staff table: staff are signed in with the same Supabase auth as applicants, but have no lead. */
export async function isStaffUser(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from('staff').select('user_id').eq('user_id', userId).eq('active', true).maybeSingle();
  return !!data;
}

/**
 * Signs this browser in again as the user with that email (cookies are written by the server client). Changing a
 * password through the admin API ends every session of the user, this one included, so the browser that just set the
 * password is given a fresh session while all the others stay signed out, which is what a password change should do.
 */
export async function reopenSession(db: Db, email: string): Promise<void> {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);
  const supabase = await createServerSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`);
}

/** Did a lead already exist for this auth user (by link or by email) before this sign-in? */
export async function leadExistsForUser(db: Db, user: { id: string; email?: string | null }): Promise<boolean> {
  const byUser = await db.from('leads').select('id').eq('user_id', user.id).maybeSingle();
  if (byUser.data) return true;
  if (!user.email) return false;
  const byEmail = await db.from('leads').select('id').eq('email', user.email.toLowerCase()).maybeSingle();
  return !!byEmail.data;
}

const tenMinuteKey = (d = new Date()) => `${d.toISOString().slice(0, 15)}`;

/**
 * "Forgot it?": emails a one-hour link that signs the owner in and opens the "set a password" screen. Runs after the
 * response has gone out, so the answer never depends on whether the address is known. Unknown addresses get nothing.
 * Per address: at most 5 requests an hour, so nobody can flood a mailbox from many IPs.
 */
export async function sendPasswordReset(email: string, locale: Locale): Promise<void> {
  try {
    const db = createAdminSupabase();
    if (!(await rateLimit(db, `forgot-email:${email}`, { windowSeconds: 3600, max: 5 }))) return;

    const lead = await findLeadByEmail(db, email);
    let userId: string | null = lead?.user_id ?? null;
    if (!userId) {
      const { data } = await db.rpc('auth_user_id_by_email', { p_email: email });
      userId = (data as string | null) ?? null;
    }
    // a lead that never opened the portal has no auth user yet: the reset link is how it gets one
    if (!userId && lead) userId = (await ensureAuthUser(db, lead)).userId;
    if (!userId) return;

    const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);
    const next = encodeURIComponent('/create-password?mode=reset');
    const resetUrl = campaignUrl(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${next}`, locale);
    const dedupeKey = `password-reset:${userId}:${tenMinuteKey()}`;

    if (lead) {
      await queueEmail({ template: 'password-reset', lead, data: { resetUrl }, dedupeKey });
      return;
    }
    await queueStaffReset(db, { email, userId, locale, resetUrl, dedupeKey });
  } catch (e) {
    console.error('[auth] sendPasswordReset failed', e);
  }
}

/** Staff have no lead row, so the reset email is rendered here instead of through queueEmail (which needs a lead). */
async function queueStaffReset(
  db: Db,
  a: { email: string; userId: string; locale: Locale; resetUrl: string; dedupeKey: string },
): Promise<void> {
  const { data: staff } = await db.from('staff').select('full_name').eq('user_id', a.userId).maybeSingle();
  const fullName = staff?.full_name ?? a.email;
  const ctx: EmailContext = {
    locale: a.locale,
    lead: { id: a.userId, firstName: fullName.split(/\s+/)[0] ?? '', fullName, email: a.email, caseRef: null, route: null },
    links: {
      portal: campaignUrl('/sign-in', a.locale),
      site: process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? 'https://www.lawoffice.org.il',
      privacy: campaignUrl('/privacy', a.locale),
      unsubscribe: null,
      logo: `${campaignUrl('', 'en')}/email/dpl-logo.png`,
      teamPhoto: `${campaignUrl('', 'en')}/email/dpl-team.jpg`,
      booking: campaignUrl('/', a.locale),
    },
    data: { resetUrl: a.resetUrl },
  };
  const rendered = renderEmail('password-reset', ctx);
  const payload: EmailPayload = {
    template: 'password-reset',
    locale: a.locale,
    to: { email: a.email, name: fullName },
    from: { email: process.env.EMAIL_FROM_ADDRESS ?? 'cases@euro-passports.com', name: process.env.EMAIL_FROM_NAME ?? 'Decker Pex Levi' },
    replyTo: process.env.EMAIL_REPLY_TO ?? 'office@lawoffice.org.il',
    subject: rendered.subject,
    preheader: rendered.preheader,
    html: rendered.html,
    text: rendered.text,
    category: 'transactional',
  };
  await enqueueEmail(db, { leadId: null, payload, dedupeKey: a.dedupeKey });
}

/**
 * "Send me a new link" (an expired or replaced emailed link): the same "your file" email as the first one, for the
 * lead that owns the address, if any. Silent for unknown addresses; at most one a minute per address.
 */
export async function sendNewPortalLink(email: string): Promise<void> {
  try {
    const db = createAdminSupabase();
    if (!(await rateLimit(db, `link-email:${email}`, { windowSeconds: 3600, max: 5 }))) return;
    const lead = await findLeadByEmail(db, email);
    if (lead) await sendFileLink(db, lead, 'resend');
  } catch (e) {
    console.error('[auth] sendNewPortalLink failed', e);
  }
}
