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
 *  5. The same holds for sign-in accounts: an address that already has an account which is not this lead's own (staff,
 *     a hand-made account, one registered by somebody else) is never taken over by the holder of a lead cookie. Only
 *     an emailed link, which proves the mailbox, may link such an account (never a staff account), and "Go to my
 *     portal" never signs anyone in as staff.
 */

/**
 * The address of the lead already belongs to a sign-in account that is not this lead's own (a member of staff, an
 * account somebody registered by hand, one created by someone else with the same address). Whoever holds only the lead
 * cookie must never be signed in as that account.
 */
export class AccountEmailInUse extends Error {
  constructor() {
    super('account_email_in_use');
    this.name = 'AccountEmailInUse';
  }
}

export interface AdoptOptions {
  /**
   * The caller has already seen the owner of the mailbox prove control of it (an emailed link). Only then may the lead
   * take over an existing account that someone else made for the address; a member of staff never can.
   */
  mailboxProven?: boolean;
}

const isStaffUserId = async (db: Db, userId: string): Promise<boolean> => {
  const { data } = await db.from('staff').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
};

/**
 * May this lead take over the existing sign-in account `userId`? 'own': the account the server itself made for this very
 * lead (`app_metadata.lead_id`, which only the server can write: an earlier request created it and was cut off before
 * linking it). 'proven': an account someone else made for the address, allowed only once the mailbox is proven and no
 * other lead holds it. A staff account never.
 */
async function adoption(db: Db, userId: string, lead: LeadRow, opts: AdoptOptions): Promise<'own' | 'proven' | null> {
  if (await isStaffUserId(db, userId)) return null;
  const { data } = await db.auth.admin.getUserById(userId);
  if ((data?.user?.app_metadata as { lead_id?: string } | undefined)?.lead_id === lead.id) return 'own';
  if (!opts.mailboxProven) return null;
  const { data: other } = await db.from('leads').select('id').eq('user_id', userId).neq('id', lead.id).maybeSingle();
  return other ? null : 'proven';
}

/**
 * Takes over an account somebody else registered for the address. Whoever made it may know its password and may hold
 * sessions, and the mailbox owner has just proven the address is theirs: both are replaced (the same defence as
 * markEmailVerified applies to the account of a lead).
 */
async function takeOver(db: Db, userId: string, lead: LeadRow): Promise<void> {
  const { error } = await db.auth.admin.updateUserById(userId, {
    password: randomPassword(),
    email_confirm: true,
    app_metadata: { lead_id: lead.id },
  });
  if (error) throw new Error(`taking over the account failed: ${error.message}`);
  await db.rpc('revoke_user_sessions', { p_user: userId });
}

/**
 * The Supabase user for a lead; creates (and links) it on first use. An address that already has a sign-in account
 * that is not this lead's own is NOT taken over (AccountEmailInUse) unless the mailbox has been proven: linking such an
 * account would let the holder of a lead cookie, who has proved nothing, sign in as it ("Go to my portal"), a member of
 * staff included.
 */
export async function ensureAuthUser(db: Db, lead: LeadRow, opts: AdoptOptions = {}): Promise<{ userId: string; lead: LeadRow }> {
  if (lead.user_id) return { userId: lead.user_id, lead };

  const lookup = async () => ((await db.rpc('auth_user_id_by_email', { p_email: lead.email })).data as string | null) ?? null;
  const adopt = async (id: string): Promise<void> => {
    const how = await adoption(db, id, lead, opts);
    if (!how) throw new AccountEmailInUse();
    if (how === 'proven') await takeOver(db, id, lead);
  };

  let userId = await lookup();
  if (userId) {
    await adopt(userId);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: lead.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: lead.full_name, lead_id: lead.id },
      app_metadata: { lead_id: lead.id },
    });
    if (data?.user) userId = data.user.id;
    else {
      // a concurrent request (a double click) created it a moment ago: that one is ours, anyone else's is not
      userId = await lookup();
      if (!userId) throw new Error(`createUser failed: ${error?.message ?? 'unknown'}`);
      await adopt(userId);
    }
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
 * The lead has a portal account from now on: stage "account", status "Account created", one activity line and one
 * `account.created` event for the firm's CRM. Idempotent; the first caller wins. Every path that gives the applicant a
 * portal session calls this: the "Go to my portal" button and the emailed /go link (via openPortalSession), and the
 * Google and password-reset sign-ins (the auth callback), which find or link the lead without creating anything.
 */
export async function markAccountCreated(db: Db, lead: LeadRow): Promise<LeadRow> {
  if (lead.account_created_at) return lead;
  const { data, error } = await db
    .from('leads')
    .update({
      account_created_at: new Date().toISOString(),
      stage: advanceStage(lead.stage, 'account_created'),
      status: advanceStatus(lead.status, 'account_created'),
    })
    .eq('id', lead.id)
    .is('account_created_at', null)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`lead update failed: ${error.message}`);
  if (!data) {
    // a concurrent request marked it first and wrote the activity line and the event
    const { data: fresh } = await db.from('leads').select('*').eq('id', lead.id).single();
    return fresh ?? lead;
  }
  await logActivity(db, { leadId: lead.id, code: 'account_created', text: 'Portal account created' });
  await enqueueEvent(db, {
    type: 'account.created',
    leadId: lead.id,
    payload: { lead: leadSnapshot(data) },
    dedupeKey: `account.created:${lead.id}`,
  });
  return data;
}

/**
 * Signs the current browser in as the lead's user (cookies are written by the server client) and renews the lead
 * cookie. Route Handlers and Server Actions only. The caller must already have established that this browser may
 * enter the lead: valid lead cookie, a verified emailed token, or a fresh OAuth login.
 */
export async function openPortalSession(db: Db, lead: LeadRow, opts: AdoptOptions = {}): Promise<LeadRow> {
  const { lead: l, userId } = await ensureAuthUser(db, lead, opts);
  // a lead is never a way into a staff account, whatever links it
  if (await isStaffUserId(db, userId)) throw new AccountEmailInUse();

  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: l.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);

  const supabase = await createServerSupabase();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`);

  const current = await markAccountCreated(db, l);
  await setLeadCookie(current);
  return current;
}

/**
 * The applicant corrected the address of a lead whose mailbox was never proven. The new address is a new identity: the
 * sign-in user follows it (its password is replaced and its sessions end), the address is unverified again, and every
 * emailed link and lead cookie issued so far dies (`session_epoch` + 1; the caller reissues this browser's cookie). A
 * mistyped address can belong to a stranger, who must not keep a working link into the file.
 * Returns null when the new address is taken by another sign-in user or lead (nothing is changed then).
 */
export async function changeLeadEmail(db: Db, lead: LeadRow, email: string, extra: Partial<LeadRow> = {}): Promise<LeadRow | null> {
  // a lead without an account of its own cannot move to an address that already has one (staff, someone else's)
  if (!lead.user_id && (await db.rpc('auth_user_id_by_email', { p_email: email })).data) return null;
  if (lead.user_id) {
    const { error } = await db.auth.admin.updateUserById(lead.user_id, { email, email_confirm: true, password: randomPassword() });
    if (error) return null;
  }
  const { data, error } = await db
    .from('leads')
    .update({ ...extra, email, email_verified_at: null, password_set_at: null, session_epoch: lead.session_epoch + 1 })
    .eq('id', lead.id)
    .select('*')
    .single();
  if (error || !data) {
    // keep the two records consistent: put the sign-in user back
    if (lead.user_id) await db.auth.admin.updateUserById(lead.user_id, { email: lead.email, email_confirm: true });
    if (error?.code === '23505') return null;
    throw new Error(`changeLeadEmail failed: ${error?.message ?? 'no row'}`);
  }
  if (lead.user_id) await db.rpc('revoke_user_sessions', { p_user: lead.user_id });
  return data;
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
