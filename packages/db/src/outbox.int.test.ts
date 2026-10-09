import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from './database.types';
import { enqueueEmail, enqueueEvent, logActivity } from './outbox';
import { rateLimit } from './rate-limit';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!(url && service))('outbox + rate limit (real database)', () => {
  const db = createClient<Database>(url!, service!, { auth: { persistSession: false } });
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
