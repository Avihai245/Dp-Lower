/**
 * Integration test against the REAL local Supabase (GoTrue + Postgres + RLS): `supabase start`.
 * Proves the lead -> account bridge and the pre-registration defence described in docs/ARCHITECTURE.md section 7.
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from './database.types';
import { ensureAuthUser, markAccountCreated, markEmailVerified } from './portal-session';
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
  afterAll(async () => {
    const { data: leads } = await db.from('leads').select('id, user_id').like('email', `%-${stamp}@example.com`);
    for (const lead of leads ?? []) if (lead.user_id) await db.auth.admin.deleteUser(lead.user_id);
    await db.from('leads').delete().like('email', `%-${stamp}@example.com`);
  });

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
});
