import 'server-only';
import { advanceStage, advanceStatus, capitalizeName, routeFromAnswers, type Locale } from '@dpl/core';
import type { User } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { createServerSupabase } from './server';
import { getCookieLead, setLeadCookie } from './lead-session';
import { enqueueEvent, leadSnapshot, logActivity } from './outbox';
import { asJson, type Db, type LeadRow } from './types';

const randomPassword = () => randomBytes(24).toString('base64url');

/**
 * Authentication model (the lead -> account bridge). Read docs/ARCHITECTURE.md before changing anything here.
 *
 *  1. POST /api/leads creates the lead and sets the lead cookie (this browser created it).
 *  2. "Go to my portal" calls openPortalSession(): the server creates the Supabase user for the lead (confirmed in
 *     GoTrue terms so OTP login works; real mailbox proof is tracked in leads.email_verified_at) and signs this
 *     browser in with a server-generated one-time token. No password and no email round trip, as designed.
 *  3. Because that session is granted without proof of mailbox ownership, the first time the owner proves control
 *     (clicks an emailed link, or signs in with Google) markEmailVerified() runs. If that happens in a DIFFERENT
 *     browser than the one that created the lead, anything set up before (password, sessions, lead cookie) is
 *     revoked: this defeats pre-registration of somebody else's email address.
 *  4. A lead that already exists for the email can only be re-entered through an emailed link (/go/[token]).
 */

/** The Supabase user for a lead; creates (and links) it on first use. */
export async function ensureAuthUser(db: Db, lead: LeadRow): Promise<{ userId: string; lead: LeadRow }> {
  if (lead.user_id) return { userId: lead.user_id, lead };

  const { data: existing } = await db.rpc('auth_user_id_by_email', { p_email: lead.email });
  let userId = (existing as string | null) ?? null;
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email: lead.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: lead.full_name, lead_id: lead.id },
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? 'unknown'}`);
    userId = data.user.id;
  }
  const { data: updated, error } = await db
    .from('leads')
    .update({ user_id: userId })
    .eq('id', lead.id)
    .select('*')
    .single();
  if (error || !updated) throw new Error(`linking user to lead failed: ${error?.message ?? 'unknown'}`);
  return { userId, lead: updated };
}

/**
 * Signs the current browser in as the lead's user (cookies are written by the server client) and renews the lead
 * cookie. Route Handlers and Server Actions only. The caller must already have established that this browser may
 * enter the lead: valid lead cookie, a verified emailed token, or a fresh OAuth login.
 */
export async function openPortalSession(db: Db, lead: LeadRow): Promise<LeadRow> {
  const { lead: l } = await ensureAuthUser(db, lead);

  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: l.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);

  const supabase = await createServerSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`);

  let current = l;
  if (!l.account_created_at) {
    const { data: updated, error: upErr } = await db
      .from('leads')
      .update({
        account_created_at: new Date().toISOString(),
        stage: advanceStage(l.stage, 'account_created'),
        status: advanceStatus(l.status, 'account_created'),
      })
      .eq('id', l.id)
      .select('*')
      .single();
    if (upErr || !updated) throw new Error(`lead update failed: ${upErr?.message ?? 'unknown'}`);
    current = updated;
    await logActivity(db, { leadId: l.id, code: 'account_created', text: 'Portal account created' });
    await enqueueEvent(db, {
      type: 'account.created',
      leadId: l.id,
      payload: { lead: leadSnapshot(current) },
      dedupeKey: `account.created:${l.id}`,
    });
  }
  await setLeadCookie(current);
  return current;
}

/** Was this request made from the browser that created the lead (lead cookie) or one already signed in as it? */
export async function isSameBrowser(db: Db, lead: LeadRow): Promise<boolean> {
  const byCookie = await getCookieLead(db);
  if (byCookie?.id === lead.id) return true;
  if (!lead.user_id) return false;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id === lead.user_id;
}

/**
 * The owner proved control of the mailbox (emailed link, Google). Idempotent.
 * From a different browser than the creator's, earlier credentials are revoked (see the model above).
 */
export async function markEmailVerified(db: Db, lead: LeadRow, opts: { sameBrowser: boolean }): Promise<LeadRow> {
  if (lead.email_verified_at) return lead;
  const patch: Partial<LeadRow> = { email_verified_at: new Date().toISOString() };
  if (!opts.sameBrowser) {
    if (lead.user_id) {
      await db.auth.admin.updateUserById(lead.user_id, { password: randomPassword() });
      await db.rpc('revoke_user_sessions', { p_user: lead.user_id });
    }
    patch.session_epoch = lead.session_epoch + 1;
    patch.password_set_at = null;
  }
  const { data, error } = await db.from('leads').update(patch).eq('id', lead.id).select('*').single();
  if (error || !data) throw new Error(`markEmailVerified failed: ${error?.message ?? 'unknown'}`);
  await logActivity(db, { leadId: lead.id, code: 'email_verified', text: 'Email address verified' });
  return data;
}

/**
 * A signed-in Supabase user with no lead yet (Google sign-in without going through the quiz): create the lead so
 * the portal and the CRM have a record. Source 'oauth'.
 */
export async function ensureLeadForUser(db: Db, user: User, locale: Locale): Promise<LeadRow> {
  const { data: byUser } = await db.from('leads').select('*').eq('user_id', user.id).maybeSingle();
  if (byUser) return byUser;
  const email = (user.email ?? '').toLowerCase();
  const { data: byEmail } = await db.from('leads').select('*').eq('email', email).maybeSingle();
  if (byEmail) {
    const { data } = await db.from('leads').update({ user_id: user.id }).eq('id', byEmail.id).select('*').single();
    return data ?? byEmail;
  }
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const { data, error } = await db
    .from('leads')
    .insert({
      full_name: capitalizeName(meta.full_name ?? meta.name ?? email.split('@')[0] ?? 'Applicant'),
      email,
      user_id: user.id,
      locale,
      source: 'oauth',
      route: routeFromAnswers({}),
      answers: asJson({}),
      account_created_at: new Date().toISOString(),
      stage: 'account',
      status: 'account_created',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`ensureLeadForUser failed: ${error?.message ?? 'unknown'}`);
  await logActivity(db, { leadId: data.id, code: 'lead_created_oauth', text: 'Account created with Google' });
  await enqueueEvent(db, { type: 'lead.created', leadId: data.id, payload: { lead: leadSnapshot(data) }, dedupeKey: `lead.created:${data.id}` });
  return data;
}
