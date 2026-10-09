import { createAdminSupabase } from '@dpl/db/admin';
import type { Db } from '@dpl/db/types';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupLeads, loadLocalEnv, makeLead } from './test-env';

vi.mock('server-only', () => ({}));
// the dispatcher route is tested for who may call it and what it answers; the scheduler and the delivery have their own tests
vi.mock('./drip', () => ({
  scheduleDueEmails: vi.fn(async () => ({ leads: 3, scheduled: 2, skipped: 1, stopped: 0, errors: 0 })),
  syncSequenceDelivery: vi.fn(async () => 2),
}));
vi.mock('@dpl/db/dispatch', () => ({
  deliverPending: vi.fn(async () => ({ claimed: 5, sent: 4, failed: 1, dead: 0 })),
}));
// the clean-up of past calls has its own test (bookings.int.test.ts)
vi.mock('./bookings', () => ({ completePastBookings: vi.fn(async () => 3) }));

const hasDb = loadLocalEnv();

describe('Standard Webhooks verification', () => {
  const secret = `v1,whsec_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}`;
  const body = JSON.stringify({ user: { email: 'a@b.co' }, email_data: { email_action_type: 'recovery' } });
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);
  let mod: typeof import('./standard-webhooks');
  beforeAll(async () => {
    mod = await import('./standard-webhooks');
  });
  const sign = (o: Partial<{ id: string; timestamp: number; body: string; secret: string }> = {}) =>
    mod.signStandardWebhook({
      secret: o.secret ?? secret,
      id: o.id ?? 'msg_1',
      timestamp: o.timestamp ?? now / 1000,
      body: o.body ?? body,
    });
  const verify = (o: Partial<Parameters<typeof mod.verifyStandardWebhook>[0]> = {}) =>
    mod.verifyStandardWebhook({
      secret,
      id: 'msg_1',
      timestamp: String(now / 1000),
      signature: sign(),
      body,
      now,
      ...o,
    });

  it('accepts a correct signature', () => {
    expect(verify()).toBe(true);
  });

  it('accepts when one of several signatures matches (key rotation)', () => {
    expect(verify({ signature: `v1,AAAA ${sign()} v2,BBBB` })).toBe(true);
  });

  it('rejects a wrong secret, a tampered body, a different id or timestamp and malformed headers', () => {
    expect(
      verify({
        signature: sign({
          secret: `v1,whsec_${Buffer.from('another secret another secret!!').toString('base64')}`,
        }),
      }),
    ).toBe(false);
    expect(verify({ body: `${body} ` })).toBe(false);
    expect(verify({ id: 'msg_2' })).toBe(false);
    expect(verify({ timestamp: String(now / 1000 + 1) })).toBe(false);
    expect(verify({ signature: 'v1,not base64!!' })).toBe(false);
    expect(verify({ signature: sign().replace('v1,', 'v2,') })).toBe(false);
    expect(verify({ signature: null })).toBe(false);
    expect(verify({ id: null })).toBe(false);
    expect(verify({ timestamp: 'abc' })).toBe(false);
    expect(verify({ secret: '' })).toBe(false);
  });

  it('rejects a timestamp more than five minutes off, in either direction', () => {
    const at = (offset: number) => ({
      timestamp: String(now / 1000 + offset),
      signature: sign({ timestamp: now / 1000 + offset }),
    });
    expect(verify(at(-299))).toBe(true);
    expect(verify(at(299))).toBe(true);
    expect(verify(at(-301))).toBe(false);
    expect(verify(at(301))).toBe(false);
  });

  it('understands the secret with and without the v1,whsec_ prefix', () => {
    const bare = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
    expect(mod.decodeWebhookSecret(secret)?.toString()).toBe('0123456789abcdef0123456789abcdef');
    expect(mod.decodeWebhookSecret(bare)?.toString()).toBe('0123456789abcdef0123456789abcdef');
    expect(mod.decodeWebhookSecret('v1,whsec_')).toBeNull();
  });
});

describe('POST /api/cron/dispatch', () => {
  let route: typeof import('../app/api/cron/dispatch/route');
  beforeAll(async () => {
    route = await import('../app/api/cron/dispatch/route');
  });
  // the route builds its database client from the environment; the steps themselves are mocked, so any values do
  beforeEach(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:1');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'unused');
  });
  afterEach(() => vi.unstubAllEnvs());

  const call = (method: 'POST' | 'GET', headers: Record<string, string> = {}) =>
    (method === 'POST' ? route.POST : route.GET)(
      new NextRequest('http://localhost:3001/api/cron/dispatch', { method, headers }),
      {},
    );

  it('answers 401 without the secret', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    const res = await call('POST');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('answers 401 for a wrong secret, a wrong scheme and an empty bearer', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    for (const authorization of [
      'Bearer nope',
      'Bearer a-long-cron-secre',
      'Bearer a-long-cron-secret-x',
      'Basic a-long-cron-secret',
      'a-long-cron-secret',
      'Bearer ',
    ]) {
      expect((await call('POST', { authorization })).status).toBe(401);
    }
  });

  it('is closed when no secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('POST', { authorization: 'Bearer ' })).status).toBe(401);
    expect((await call('POST', { authorization: 'Bearer undefined' })).status).toBe(401);
  });

  it('runs the scheduler and the delivery for POST with the bearer secret, and answers with the counts', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    const res = await call('POST', { authorization: 'Bearer a-long-cron-secret' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      scheduled: 2,
      skipped: 1,
      delivered: 4,
      failed: 1,
      leads: 3,
      claimed: 5,
      sequenceSent: 2,
      bookingsCompleted: 3,
    });
  });

  it('accepts the same header from Vercel Cron, which calls with GET', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    expect((await call('GET', { authorization: 'Bearer a-long-cron-secret' })).status).toBe(200);
    expect((await call('GET')).status).toBe(401);
  });

  it('answers 500 (with the counts it has) when a step fails, and still runs the others', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    const drip = await import('./drip');
    vi.mocked(drip.scheduleDueEmails).mockRejectedValueOnce(new Error('db down'));
    const res = await call('POST', { authorization: 'Bearer a-long-cron-secret' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'dispatch_failed', delivered: 4 });
    expect(body.details[0]).toContain('db down');
  });

  it('a failing clean-up of past calls does not stop the emails', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-cron-secret');
    const bookings = await import('./bookings');
    vi.mocked(bookings.completePastBookings).mockRejectedValueOnce(new Error('rpc down'));
    const res = await call('POST', { authorization: 'Bearer a-long-cron-secret' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'dispatch_failed',
      scheduled: 2,
      delivered: 4,
      bookingsCompleted: 0,
    });
    expect(body.details).toEqual([expect.stringContaining('bookings: rpc down')]);
  });
});

describe.skipIf(!hasDb)('POST /api/auth/send-email (local Supabase)', () => {
  const secret = `v1,whsec_${Buffer.from('send-email-hook-secret-for-tests!').toString('base64')}`;
  let db: Db;
  let route: typeof import('../app/api/auth/send-email/route');
  let hook: typeof import('./standard-webhooks');
  const created: string[] = [];
  const keys: string[] = [];

  beforeAll(async () => {
    vi.stubEnv('SEND_EMAIL_HOOK_SECRET', secret);
    db = createAdminSupabase();
    route = await import('../app/api/auth/send-email/route');
    hook = await import('./standard-webhooks');
  });
  afterEach(() => vi.stubEnv('SEND_EMAIL_HOOK_SECRET', secret));
  afterAll(async () => {
    vi.unstubAllEnvs();
    await cleanupLeads(db, created);
    if (keys.length) await db.from('events').delete().in('dedupe_key', keys);
  });

  const payload = (o: {
    email: string;
    action?: string;
    extra?: Record<string, unknown>;
    user?: Record<string, unknown>;
  }) =>
    JSON.stringify({
      user: { id: '5b8e5f48-0000-4000-8000-000000000001', email: o.email, user_metadata: {}, ...o.user },
      email_data: {
        token: '123456',
        token_hash: 'hash-abc',
        redirect_to: 'http://localhost:3001/auth/callback?next=%2Fcreate-password%3Fmode%3Dreset',
        email_action_type: o.action ?? 'recovery',
        site_url: 'http://127.0.0.1:54321',
        token_new: '',
        token_hash_new: '',
        ...o.extra,
      },
    });

  const send = async (
    body: string,
    o: { id?: string; timestamp?: number; signature?: string | null } = {},
  ) => {
    const id = o.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = o.timestamp ?? Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
    };
    const signature =
      o.signature === undefined ? hook.signStandardWebhook({ secret, id, timestamp, body }) : o.signature;
    if (signature) headers['webhook-signature'] = signature;
    const res = await route.POST(
      new NextRequest('http://localhost:3001/api/auth/send-email', { method: 'POST', headers, body }),
    );
    return { res, id };
  };
  const events = async (id: string) => {
    const { data } = await db
      .from('events')
      .select('*')
      .like('dedupe_key', `auth:${id}:%`)
      .order('dedupe_key');
    return data ?? [];
  };
  const body = (e: { payload: unknown }) =>
    e.payload as {
      template: string;
      locale: string;
      subject: string;
      html: string;
      text: string;
      to: { email: string };
      category: string;
    };

  it('rejects a request without a signature, with a bad one, with a tampered body and with a stale timestamp (401)', async () => {
    const good = payload({ email: 'nobody@example.com' });
    const unsigned = await send(good, { signature: null });
    expect(unsigned.res.status).toBe(401);
    const bad = await send(good, { signature: 'v1,Zm9vYmFy' });
    expect(bad.res.status).toBe(401);
    expect(await bad.res.json()).toEqual({ error: { http_code: 401, message: 'invalid_signature' } });
    const id = 'msg_tamper';
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = hook.signStandardWebhook({ secret, id, timestamp, body: good });
    const tampered = await send(good.replace('nobody', 'someone'), { id, timestamp, signature: signed });
    expect(tampered.res.status).toBe(401);
    const old = Math.floor(Date.now() / 1000) - 6 * 60;
    const stale = await send(good, { timestamp: old });
    expect(stale.res.status).toBe(401);
    for (const r of [unsigned, bad, tampered, stale]) expect(await events(r.id)).toHaveLength(0);
  });

  it('is closed (500) when the hook secret is not configured, never open', async () => {
    vi.stubEnv('SEND_EMAIL_HOOK_SECRET', '');
    const { res } = await send(payload({ email: 'nobody@example.com' }));
    expect(res.status).toBe(500);
  });

  it('answers 400 for a signed body that is not a hook payload', async () => {
    expect((await send('not json')).res.status).toBe(400);
    expect((await send(JSON.stringify({ hello: 'world' }))).res.status).toBe(400);
  });

  it('queues the password-reset email for a recovery request: 200 {} and one outbox row', async () => {
    const email = `hook-test+${Date.now()}@example.com`;
    const { res, id } = await send(payload({ email }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    const rows = await events(id);
    expect(rows).toHaveLength(1);
    keys.push(rows[0]!.dedupe_key!);
    expect(rows[0]).toMatchObject({ type: 'email.send', channel: 'email', status: 'pending', lead_id: null });
    const p = body(rows[0]!);
    expect(p).toMatchObject({
      template: 'password-reset',
      locale: 'en',
      category: 'transactional',
      to: { email },
      subject: 'Set a new password',
    });
    // the link goes to our own callback with the token hash, the type and a safe `next`
    expect(p.html).toContain(
      'http://localhost:3001/auth/callback?token_hash=hash-abc&amp;type=recovery&amp;next=%2Fcreate-password%3Fmode%3Dreset',
    );
    expect(p.text).toContain(
      'http://localhost:3001/auth/callback?token_hash=hash-abc&type=recovery&next=%2Fcreate-password%3Fmode%3Dreset',
    );
    expect(p.html).not.toMatch(/unsubscribe/i);
  });

  it('uses the lead’s language and name (looked up by email), and is idempotent for a redelivered webhook', async () => {
    const l = await makeLead(db, { createdAt: new Date(), locale: 'he', name: 'דוד כהן' });
    created.push(l.id);
    const text = payload({ email: l.email.toUpperCase() });
    const first = await send(text, { id: 'msg_replay_he_1' });
    const again = await send(text, { id: 'msg_replay_he_1' });
    expect(first.res.status).toBe(200);
    expect(again.res.status).toBe(200);
    const rows = await events('msg_replay_he_1');
    expect(rows).toHaveLength(1);
    keys.push(rows[0]!.dedupe_key!);
    expect(rows[0]!.lead_id).toBe(l.id);
    const p = body(rows[0]!);
    expect(p.locale).toBe('he');
    expect(p.subject).toBe('הגדרת סיסמה חדשה');
    expect(p.html).toContain('<html lang="he" dir="rtl">');
    expect(p.html).toContain('http://localhost:3001/he/auth/callback?token_hash=hash-abc');
    expect(p.html).toContain('דוד');
  });

  it('turns magic links, signup confirmations and codes into the auth-link email', async () => {
    const email = `hook-test+${Date.now()}-m@example.com`;
    const magic = await send(
      payload({ email, action: 'magiclink', extra: { redirect_to: 'http://localhost:3001/' } }),
    );
    const confirm = await send(payload({ email, action: 'signup' }));
    const code = await send(payload({ email, action: 'reauthentication' }));
    for (const r of [magic, confirm, code]) {
      expect(r.res.status).toBe(200);
      keys.push(...(await events(r.id)).map((e) => e.dedupe_key!));
    }
    const m = body((await events(magic.id))[0]!);
    expect(m).toMatchObject({ template: 'auth-link', subject: 'Your sign-in link' });
    expect(m.html).toContain('type=magiclink&amp;next=%2Fportal');
    expect(body((await events(confirm.id))[0]!).subject).toBe('Confirm your email address');
    const c = body((await events(code.id))[0]!);
    expect(c.subject).toBe('Your confirmation code');
    expect(c.html).toContain('123456');
  });

  it('refuses a redirect_to that tries to send the person somewhere else', async () => {
    const email = `hook-test+${Date.now()}-r@example.com`;
    const { res, id } = await send(
      payload({ email, extra: { redirect_to: 'https://evil.example/x?next=https%3A%2F%2Fevil.example' } }),
    );
    expect(res.status).toBe(200);
    const rows = await events(id);
    keys.push(...rows.map((r) => r.dedupe_key!));
    const html = body(rows[0]!).html;
    expect(html).toContain('next=%2Fcreate-password%3Fmode%3Dreset');
    expect(html).not.toContain('evil.example');
  });

  it('sends both emails of a secure email change, with the reversed token names handled', async () => {
    const email = `hook-test+${Date.now()}-c@example.com`;
    const fresh = `hook-test+${Date.now()}-n@example.com`;
    const { res, id } = await send(
      payload({
        email,
        action: 'email_change',
        user: { new_email: fresh },
        extra: { token_hash: 'hash-for-new', token_hash_new: 'hash-for-current' },
      }),
    );
    expect(res.status).toBe(200);
    const rows = await events(id);
    keys.push(...rows.map((r) => r.dedupe_key!));
    const byRecipient = Object.fromEntries(rows.map((r) => [body(r).to.email, body(r)]));
    expect(Object.keys(byRecipient).sort()).toEqual([email, fresh].sort());
    expect(byRecipient[email]!.html).toContain('token_hash=hash-for-current');
    expect(byRecipient[fresh]!.html).toContain('token_hash=hash-for-new');
  });

  it('acknowledges security notifications it has no template for (200, nothing queued)', async () => {
    const { res, id } = await send(
      payload({ email: 'nobody@example.com', action: 'password_changed_notification' }),
    );
    expect(res.status).toBe(200);
    expect(await events(id)).toHaveLength(0);
  });
});
