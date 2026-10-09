import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from './database.types';
import { cancelPendingEmails, cancelPendingNurture, enqueueEmail, enqueueEvent, logActivity } from './outbox';
import { rateLimit } from './rate-limit';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!(url && service))('outbox + rate limit (real database)', () => {
  const db = createClient<Database>(url ?? 'http://127.0.0.1:1', service ?? 'unused', { auth: { persistSession: false } }); // the body also runs when the suite is skipped
  const tag = `t${Date.now()}`;

  // the database is shared with other work: leave nothing behind
  afterAll(async () => {
    await db.from('events').delete().in('dedupe_key', [`lead.created:${tag}`, `email:${tag}`]);
    await db.from('leads').delete().in('email', [`out-${tag}@example.com`, `log-${tag}@example.com`]);
    await db.from('rate_limits').delete().like('key', `test:${tag}%`);
  });

  it('enqueueEvent is idempotent per dedupe key', async () => {
    const { data: lead } = await db.from('leads').insert({ full_name: 'Out Box', email: `out-${tag}@example.com` }).select('*').single();
    for (let i = 0; i < 3; i++) await enqueueEvent(db, { type: 'lead.created', leadId: lead!.id, payload: { n: i }, dedupeKey: `lead.created:${tag}` });
    const { data } = await db.from('events').select('*').eq('dedupe_key', `lead.created:${tag}`);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ type: 'lead.created', channel: 'crm', status: 'pending', attempts: 0 });
  });

  it('enqueueEmail stores a rendered email on the email channel and ignores duplicates', async () => {
    const payload = { template: 'welcome-1', locale: 'en', to: { email: 'a@b.co', name: 'A' }, from: { email: 'f@b.co', name: 'F' }, replyTo: 'r@b.co', subject: 's', preheader: 'p', html: '<p>x</p>', text: 'x', category: 'nurture' } as const;
    const first = await enqueueEmail(db, { leadId: null, payload, dedupeKey: `email:${tag}` });
    const second = await enqueueEmail(db, { leadId: null, payload, dedupeKey: `email:${tag}` });
    expect(first).toMatchObject({ type: 'email.send', channel: 'email' });
    expect(second).toBeNull();
  });

  it('cancelPendingNurture stops queued nurture emails of one lead and nothing else', async () => {
    const { data: lead } = await db.from('leads').insert({ full_name: 'Stop Me', email: `stop-${tag}@example.com` }).select('*').single();
    const { data: other } = await db.from('leads').insert({ full_name: 'Keep Me', email: `keep-${tag}@example.com` }).select('*').single();
    const base = { locale: 'en', to: { email: 'a@b.co', name: 'A' }, from: { email: 'f@b.co', name: 'F' }, replyTo: 'r@b.co', subject: 's', preheader: 'p', html: '<p>x</p>', text: 'x' } as const;
    await enqueueEmail(db, { leadId: lead!.id, payload: { ...base, template: 'welcome-3', category: 'nurture' }, dedupeKey: `cancel:${tag}:nurture` });
    await enqueueEmail(db, { leadId: lead!.id, payload: { ...base, template: 'booking-confirmation', category: 'transactional' }, dedupeKey: `cancel:${tag}:tx` });
    await enqueueEmail(db, { leadId: other!.id, payload: { ...base, template: 'welcome-3', category: 'nurture' }, dedupeKey: `cancel:${tag}:other` });
    await cancelPendingNurture(db, lead!.id, 'cancelled: test');
    const status = async (key: string) => (await db.from('events').select('status, last_error').eq('dedupe_key', `cancel:${tag}:${key}`).single()).data;
    expect(await status('nurture')).toEqual({ status: 'cancelled', last_error: 'cancelled: test' });
    expect((await status('tx'))?.status).toBe('pending');
    expect((await status('other'))?.status).toBe('pending');
    await db.from('events').delete().like('dedupe_key', `cancel:${tag}:%`);
    await db.from('leads').delete().in('id', [lead!.id, other!.id]);
  });

  it('cancelPendingEmails withdraws what is queued for the old address, one template or one booking, and only for that lead', async () => {
    const { data: lead } = await db.from('leads').insert({ full_name: 'Moved House', email: `moved-${tag}@example.com` }).select('*').single();
    const { data: other } = await db.from('leads').insert({ full_name: 'Stay Put', email: `stay-${tag}@example.com` }).select('*').single();
    const base = { locale: 'en', from: { email: 'f@b.co', name: 'F' }, replyTo: 'r@b.co', subject: 's', preheader: 'p', html: '<p>x</p>', text: 'x', category: 'transactional' } as const;
    const put = (id: string, key: string, template: string, to: string) =>
      enqueueEmail(db, { leadId: id, payload: { ...base, template, to: { email: to, name: 'N' } }, dedupeKey: `withdraw:${tag}:${key}` });
    await put(lead!.id, 'old-confirmation', 'booking-confirmation', 'old@example.com');
    await put(lead!.id, 'old-status', 'status-update', 'old@example.com');
    await put(lead!.id, 'new-confirmation', 'booking-confirmation', 'new@example.com');
    await put(lead!.id, 'b1', 'booking-confirmation', 'new@example.com');
    await put(other!.id, 'other-old', 'booking-confirmation', 'old@example.com');
    const status = async (key: string) => (await db.from('events').select('status').eq('dedupe_key', `withdraw:${tag}:${key}`).single()).data?.status;

    // everything not addressed to the address the lead has now
    // (the address is compared in lower case, as addresses are stored)
    expect(await cancelPendingEmails(db, lead!.id, 'cancelled: the address was corrected', { notTo: 'NEW@example.com' })).toBe(2);
    expect(await status('old-confirmation')).toBe('cancelled');
    expect(await status('old-status')).toBe('cancelled');
    expect(await status('new-confirmation')).toBe('pending');
    expect(await status('b1')).toBe('pending');
    expect(await status('other-old')).toBe('pending');

    // one template; one booking by the start of its dedupe key (a `_` or `%` in it is not a wildcard)
    expect(await cancelPendingEmails(db, lead!.id, 'cancelled: x', { template: 'booking-confirmation', dedupePrefix: `withdraw:${tag}:b1` })).toBe(1);
    expect(await status('b1')).toBe('cancelled');
    expect(await status('new-confirmation')).toBe('pending');
    expect(await cancelPendingEmails(db, lead!.id, 'cancelled: x', { dedupePrefix: `withdraw:${tag}:%` })).toBe(0);
    await db.from('events').delete().like('dedupe_key', `withdraw:${tag}:%`);
    await db.from('leads').delete().in('id', [lead!.id, other!.id]);
  });

  it('logActivity writes the documented history', async () => {
    const { data: lead } = await db.from('leads').insert({ full_name: 'Log Gy', email: `log-${tag}@example.com` }).select('*').single();
    await logActivity(db, { leadId: lead!.id, code: 'test', text: 'Something happened', kind: 'staff', actor: null });
    const { data } = await db.from('activity_log').select('*').eq('lead_id', lead!.id);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ code: 'test', kind: 'staff', text: 'Something happened' });
  });

  it('rateLimit allows up to max per window then blocks', async () => {
    const key = `test:${tag}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(db, key, { windowSeconds: 60, max: 3 }));
    expect(results).toEqual([true, true, true, false]);
    expect(await rateLimit(db, `${key}:other`, { windowSeconds: 60, max: 3 })).toBe(true);
  });
});
