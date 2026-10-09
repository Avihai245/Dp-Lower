/**
 * Integration test against the REAL local Supabase (GoTrue + Postgres + RLS): `supabase start`.
 * Proves the lead -> account bridge and the pre-registration defence described in docs/ARCHITECTURE.md section 7.
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from './database.types';
import { AccountEmailInUse, changeLeadEmail, ensureAuthUser, markAccountCreated, markEmailVerified, openPortalSession } from './portal-session';
import type { LeadRow } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = !!(url && anon && service);

describe.skipIf(!live)('lead -> account bridge (real GoTrue)', () => {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient<Database>(url!, service!, opts);
  const stamp = Date.now();

  // the database is shared with other work: remove the leads and sign-in users this file created
  const made: string[] = [];
  afterAll(async () => {
    const { data: leads } = await db.from('leads').select('id, user_id').like('email', `%-${stamp}@example.com`);
    for (const lead of leads ?? []) if (lead.user_id) await db.auth.admin.deleteUser(lead.user_id);
    await db.from('leads').delete().like('email', `%-${stamp}@example.com`);
    for (const id of made) {
      await db.from('staff').delete().eq('user_id', id);
      await db.auth.admin.deleteUser(id);
    }
  });

  /** A sign-in account that already exists for the address, made by someone other than the lead's own request. */
  async function foreignAccount(email: string, extra: { password?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } = {}) {
    const { data, error } = await db.auth.admin.createUser({ email, password: extra.password ?? 'foreign-password-1', email_confirm: true, ...extra });
    expect(error).toBeNull();
    made.push(data.user!.id);
    return data.user!.id;
  }

  async function newLead(tag: string): Promise<LeadRow> {
    const { data, error } = await db.from('leads').insert({ full_name: `Int ${tag}`, email: `int-${tag}-${stamp}@example.com` }).select('*').single();
    expect(error).toBeNull();
    return data!;
  }
  async function signInWithOtp(email: string) {
    const { data } = await db.auth.admin.generateLink({ type: 'magiclink', email });
    const client = createClient<Database>(url!, anon!, opts);
    const res = await client.auth.verifyOtp({ token_hash: data!.properties!.hashed_token, type: 'magiclink' });
    return { client, ...res };
  }

  it('creates and links the auth user once, then signs in with a server-generated one-time token', async () => {
    const lead = await newLead('bridge');
    const first = await ensureAuthUser(db, lead);
    expect(first.lead.user_id).toBe(first.userId);
    const again = await ensureAuthUser(db, first.lead);
    expect(again.userId).toBe(first.userId);

    const { client, data, error } = await signInWithOtp(lead.email);
    expect(error).toBeNull();
    expect(data.user?.id).toBe(first.userId);

    // RLS: the applicant reads exactly their own lead and cannot change it
    const mine = await client.from('leads').select('id,email');
    expect(mine.data).toEqual([{ id: lead.id, email: lead.email }]);
    // the Data API is read-only for signed-in users: the write is refused outright, and nothing changed
    const hack = await client.from('leads').update({ full_name: 'Hacked', stage: 'granted' }).eq('id', lead.id).select();
    expect(hack.error?.code).toBe('42501');
    expect((await db.from('leads').select('full_name').eq('id', lead.id).single()).data?.full_name).toBe(lead.full_name);
    const forged = await client.from('leads').insert({ full_name: 'x', email: `forged-${stamp}@example.com` });
    expect(forged.error).not.toBeNull();
  });

  it('an applicant cannot read someone else\'s lead, documents or notes', async () => {
    const a = await newLead('iso-a');
    const b = await newLead('iso-b');
    await ensureAuthUser(db, a);
    await ensureAuthUser(db, b);
    await db.from('lead_notes').insert({ lead_id: b.id, body: 'internal' });
    await db.from('documents').insert({ lead_id: b.id, doc_type: 'passport', status: 'received' });
    const { client } = await signInWithOtp(a.email);
    expect((await client.from('leads').select('id')).data).toEqual([{ id: a.id }]);
    expect((await client.from('documents').select('id')).data).toEqual([]);
    expect((await client.from('lead_notes').select('id')).data).toEqual([]);
    expect((await client.from('events').select('id')).data).toEqual([]);
  });

  it('pre-registration defence: verifying from ANOTHER browser kills the attacker\'s password, sessions and cookie', async () => {
    const lead = await newLead('prereg');
    const { userId, lead: l } = await ensureAuthUser(db, lead);
    // the attacker registered the victim's address first and set a password of their own
    await db.auth.admin.updateUserById(userId, { password: 'attacker-password-1' });
    await db.from('leads').update({ password_set_at: new Date().toISOString() }).eq('id', lead.id);
    const attacker = createClient<Database>(url!, anon!, opts);
    const signedIn = await attacker.auth.signInWithPassword({ email: lead.email, password: 'attacker-password-1' });
    expect(signedIn.error).toBeNull();

    const fresh = (await db.from('leads').select('*').eq('id', lead.id).single()).data!;
    const verified = await markEmailVerified(db, fresh, { sameBrowser: false });
    expect(verified.email_verified_at).not.toBeNull();
    expect(verified.session_epoch).toBe(l.session_epoch + 1);
    expect(verified.password_set_at).toBeNull();

    const retry = await createClient<Database>(url!, anon!, opts).auth.signInWithPassword({ email: lead.email, password: 'attacker-password-1' });
    expect(retry.error).not.toBeNull();
    const refreshed = await attacker.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();
  });

  it('markAccountCreated moves the lead to "Account created" once, whoever asks first', async () => {
    const lead = await newLead('acct');
    expect(lead).toMatchObject({ stage: 'lead', status: 'enquiry', account_created_at: null });
    const [a, b] = await Promise.all([markAccountCreated(db, lead), markAccountCreated(db, lead)]);
    for (const l of [a, b]) {
      expect(l.account_created_at).not.toBeNull();
      expect(l).toMatchObject({ stage: 'account', status: 'account_created' });
    }
    expect(a.account_created_at).toBe(b.account_created_at);
    // the CRM hears about it once, and the log has one line
    const events = await db.from('events').select('id').eq('lead_id', lead.id).eq('type', 'account.created');
    expect(events.data).toHaveLength(1);
    const log = await db.from('activity_log').select('id').eq('lead_id', lead.id).eq('code', 'account_created');
    expect(log.data).toHaveLength(1);
    // idempotent: a lead that already has an account is returned as it is, and later stages are never pulled back
    await db.from('leads').update({ stage: 'application', status: 'application_incomplete' }).eq('id', lead.id);
    const later = (await db.from('leads').select('*').eq('id', lead.id).single()).data!;
    expect(await markAccountCreated(db, later)).toMatchObject({ stage: 'application', status: 'application_incomplete' });
    expect((await db.from('events').select('id').eq('lead_id', lead.id).eq('type', 'account.created')).data).toHaveLength(1);
  });

  it('verifying from the creator\'s own browser keeps their password, session and cookie epoch', async () => {
    const lead = await newLead('samebrowser');
    const { userId } = await ensureAuthUser(db, lead);
    await db.auth.admin.updateUserById(userId, { password: 'my-own-password-1' });
    const fresh = (await db.from('leads').select('*').eq('id', lead.id).single()).data!;
    const verified = await markEmailVerified(db, fresh, { sameBrowser: true });
    expect(verified.session_epoch).toBe(fresh.session_epoch);
    const ok = await createClient<Database>(url!, anon!, opts).auth.signInWithPassword({ email: lead.email, password: 'my-own-password-1' });
    expect(ok.error).toBeNull();
    // idempotent
    expect((await markEmailVerified(db, verified, { sameBrowser: false })).session_epoch).toBe(fresh.session_epoch);
  });

  it('password recovery works end to end (generateLink recovery -> verifyOtp -> updateUser)', async () => {
    const lead = await newLead('recovery');
    await ensureAuthUser(db, lead);
    const { data } = await db.auth.admin.generateLink({ type: 'recovery', email: lead.email });
    const client = createClient<Database>(url!, anon!, opts);
    const v = await client.auth.verifyOtp({ token_hash: data!.properties!.hashed_token, type: 'recovery' });
    expect(v.error).toBeNull();
    const up = await client.auth.updateUser({ password: 'brand-new-password-1' });
    expect(up.error).toBeNull();
    const login = await createClient<Database>(url!, anon!, opts).auth.signInWithPassword({ email: lead.email, password: 'brand-new-password-1' });
    expect(login.error).toBeNull();
  });

  describe('an address that already has a sign-in account of someone else', () => {
    it('is never linked to a lead on the word of a lead cookie, and a staff account never at all', async () => {
      const lead = await newLead('staff');
      const staffId = await foreignAccount(lead.email);
      await db.from('staff').insert({ user_id: staffId, full_name: 'Case Staffer', email: lead.email, role: 'case_manager' });

      await expect(ensureAuthUser(db, lead)).rejects.toBeInstanceOf(AccountEmailInUse);
      // not even when the mailbox is proven: a staff account is not an applicant's
      await expect(ensureAuthUser(db, lead, { mailboxProven: true })).rejects.toBeInstanceOf(AccountEmailInUse);
      expect((await db.from('leads').select('user_id').eq('id', lead.id).single()).data?.user_id).toBeNull();
    });

    it('a lead that was somehow linked to a staff account still cannot sign anyone in as it', async () => {
      const lead = await newLead('staff-linked');
      const staffId = await foreignAccount(lead.email);
      await db.from('staff').insert({ user_id: staffId, full_name: 'Case Staffer', email: lead.email, role: 'admin' });
      const linked = (await db.from('leads').update({ user_id: staffId }).eq('id', lead.id).select('*').single()).data!;
      // refused before any session is created (a request context is not even needed to find that out)
      await expect(openPortalSession(db, linked)).rejects.toBeInstanceOf(AccountEmailInUse);
      await expect(openPortalSession(db, linked, { mailboxProven: true })).rejects.toBeInstanceOf(AccountEmailInUse);
    });

    it('an account somebody registered by hand is not adopted by a lead cookie; an emailed link adopts it and replaces its password and sessions', async () => {
      const lead = await newLead('handmade');
      const userId = await foreignAccount(lead.email, { password: 'attacker-password-2' });
      const attacker = createClient<Database>(url!, anon!, opts);
      expect((await attacker.auth.signInWithPassword({ email: lead.email, password: 'attacker-password-2' })).error).toBeNull();

      await expect(ensureAuthUser(db, lead)).rejects.toBeInstanceOf(AccountEmailInUse);
      expect((await db.from('leads').select('user_id').eq('id', lead.id).single()).data?.user_id).toBeNull();

      const adopted = await ensureAuthUser(db, lead, { mailboxProven: true });
      expect(adopted.userId).toBe(userId);
      expect(adopted.lead.user_id).toBe(userId);
      // what the registrant knew no longer works
      expect((await createClient<Database>(url!, anon!, opts).auth.signInWithPassword({ email: lead.email, password: 'attacker-password-2' })).error).not.toBeNull();
      expect((await attacker.auth.refreshSession()).error).not.toBeNull();
    });

    it('trusts only what the server wrote: app_metadata.lead_id (an earlier, cut-off attempt) is adopted, user_metadata.lead_id (writable by anyone) is not', async () => {
      const mine = await newLead('cutoff');
      const userId = await foreignAccount(mine.email, { app_metadata: { lead_id: mine.id } });
      expect((await ensureAuthUser(db, mine)).userId).toBe(userId);

      const forged = await newLead('forged-meta');
      await foreignAccount(forged.email, { user_metadata: { lead_id: forged.id } });
      await expect(ensureAuthUser(db, forged)).rejects.toBeInstanceOf(AccountEmailInUse);
    });

    it('an account that another lead already holds is not taken, whoever vouches for the mailbox', async () => {
      const holder = await newLead('holder');
      const other = await newLead('other');
      const userId = await foreignAccount(other.email);
      await db.from('leads').update({ user_id: userId }).eq('id', holder.id);
      await expect(ensureAuthUser(db, other, { mailboxProven: true })).rejects.toBeInstanceOf(AccountEmailInUse);
    });

    it('two requests that race to create the account of a lead agree on one account (the second one finds the first one\'s)', async () => {
      const lead = await newLead('race');
      const results = await Promise.allSettled([ensureAuthUser(db, lead), ensureAuthUser(db, lead)]);
      const ok = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof ensureAuthUser>>> => r.status === 'fulfilled');
      expect(ok.length).toBeGreaterThanOrEqual(1);
      expect(new Set(ok.map((r) => r.value.userId)).size).toBe(1);
      for (const r of results) if (r.status === 'rejected') expect(r.reason).not.toBeInstanceOf(AccountEmailInUse);
    });

    it('a lead without an account cannot move to an address that has one, a lead with one is refused by the auth server', async () => {
      const lead = await newLead('mover');
      const staffId = await foreignAccount(`staff-target-${stamp}@example.com`);
      await db.from('staff').insert({ user_id: staffId, full_name: 'Target', email: `staff-target-${stamp}@example.com`, role: 'admin' });
      expect(await changeLeadEmail(db, lead, `staff-target-${stamp}@example.com`)).toBeNull();
      expect((await db.from('leads').select('email').eq('id', lead.id).single()).data?.email).toBe(lead.email);

      const withAccount = await newLead('mover-account');
      const { lead: linked } = await ensureAuthUser(db, withAccount);
      expect(await changeLeadEmail(db, linked, `staff-target-${stamp}@example.com`)).toBeNull();
      expect((await db.from('leads').select('email').eq('id', withAccount.id).single()).data?.email).toBe(withAccount.email);
    });
  });
});
