import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverPending, MAX_ATTEMPTS } from './dispatch';
import type { Db, EventRow } from './types';

const ev = (o: Partial<EventRow>): EventRow => ({
  id: 'e1', type: 'lead.created', channel: 'crm', lead_id: 'l1', payload: { a: 1 }, dedupe_key: null, status: 'processing',
  attempts: 1, next_attempt_at: new Date().toISOString(), locked_at: null, last_error: null, created_at: '2026-10-01T00:00:00Z', delivered_at: null, ...o,
});

function fakeDb(events: EventRow[], leads: Array<Record<string, unknown>> = []) {
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const db = {
    rpc: async () => ({ data: events, error: null }),
    from: (table: string) =>
      table === 'leads'
        ? { select: () => ({ in: async () => ({ data: leads, error: null }) }) }
        : { update: (patch: Record<string, unknown>) => ({ eq: async (_c: string, id: string) => { patches.push({ id, patch }); return { error: null }; } }) },
  } as unknown as Db;
  return { db, patches };
}

describe('deliverPending', () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let respond: (url: string) => Response;
  beforeEach(() => {
    calls.length = 0;
    respond = () => new Response('ok', { status: 200 });
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, init }); return respond(url); });
    process.env.ZAPIER_CRM_WEBHOOK_URL = 'https://hooks.example/crm';
    process.env.ZAPIER_EMAIL_WEBHOOK_URL = 'https://hooks.example/email';
    delete process.env.ZAPIER_WEBHOOK_URL;
    delete process.env.ZAPIER_SIGNING_SECRET;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('claims nothing without any webhook so events wait instead of being lost', async () => {
    delete process.env.ZAPIER_CRM_WEBHOOK_URL;
    delete process.env.ZAPIER_EMAIL_WEBHOOK_URL;
    const { db } = fakeDb([ev({})]);
    expect(await deliverPending(db)).toEqual({ claimed: 0, sent: 0, failed: 0, dead: 0, cancelled: 0, skipped: 'no_webhook' });
  });

  it('routes crm and email events to their own hooks and marks them sent', async () => {
    const { db, patches } = fakeDb([ev({ id: 'a' }), ev({ id: 'b', channel: 'email', type: 'email.send' })]);
    const r = await deliverPending(db);
    expect(r).toMatchObject({ claimed: 2, sent: 2, failed: 0 });
    expect(calls.map((c) => c.url)).toEqual(['https://hooks.example/crm', 'https://hooks.example/email']);
    expect(patches.every((p) => p.patch.status === 'sent')).toBe(true);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ event: 'lead.created', id: 'a', lead_id: 'l1', data: { a: 1 } });
  });

  it('signs the body with HMAC when a secret is configured', async () => {
    process.env.ZAPIER_SIGNING_SECRET = 'shh';
    const { db } = fakeDb([ev({})]);
    await deliverPending(db);
    const sig = (calls[0]!.init.headers as Record<string, string>)['x-dpl-signature'];
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('retries failures with backoff and gives up after the last attempt', async () => {
    respond = () => new Response('nope', { status: 500 });
    const { db, patches } = fakeDb([ev({ id: 'retry', attempts: 2 }), ev({ id: 'dead', attempts: MAX_ATTEMPTS })]);
    const r = await deliverPending(db);
    expect(r).toMatchObject({ claimed: 2, sent: 0, failed: 1, dead: 1 });
    const retry = patches.find((p) => p.id === 'retry')!.patch;
    expect(retry.status).toBe('pending');
    expect(String(retry.last_error)).toContain('500');
    // attempt 2 -> wait 10 minutes
    const wait = new Date(String(retry.next_attempt_at)).getTime() - Date.now();
    expect(wait).toBeGreaterThan(9 * 60_000);
    expect(wait).toBeLessThan(11 * 60_000);
    expect(patches.find((p) => p.id === 'dead')!.patch.status).toBe('dead');
  });

  it('treats a network error like a failure', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNRESET'); });
    const { db, patches } = fakeDb([ev({})]);
    expect(await deliverPending(db)).toMatchObject({ failed: 1 });
    expect(patches[0]!.patch.status).toBe('pending');
  });

  describe('nurture emails are checked again at delivery', () => {
    const lead = { id: 'l1', email: 'anna@example.com', unsubscribed_at: null, submitted_at: null, stage: 'lead', status: 'account_created' };
    const nurture = (o: Partial<EventRow> = {}) =>
      ev({ id: 'n1', channel: 'email', type: 'email.send', created_at: new Date().toISOString(), payload: { category: 'nurture', template: 'welcome-2', to: { email: 'Anna@example.com' } }, ...o });

    it('sends one that is still wanted (the address compares without case)', async () => {
      const { db } = fakeDb([nurture()], [lead]);
      expect(await deliverPending(db)).toMatchObject({ sent: 1, cancelled: 0 });
      expect(calls).toHaveLength(1);
    });

    it('drops one for a person who unsubscribed, submitted, moved past the application or whose case the team has set a status for, without posting it', async () => {
      for (const changed of [{ unsubscribed_at: '2026-10-02T00:00:00Z' }, { submitted_at: '2026-10-02T00:00:00Z' }, { stage: 'review' }, { status: 'review_completed' }]) {
        calls.length = 0;
        const { db, patches } = fakeDb([nurture()], [{ ...lead, ...changed }]);
        expect(await deliverPending(db), JSON.stringify(changed)).toMatchObject({ sent: 0, cancelled: 1 });
        expect(calls).toHaveLength(0);
        expect(patches[0]!.patch).toMatchObject({ status: 'cancelled' });
        expect(String(patches[0]!.patch.last_error)).toContain('stopped');
      }
    });

    it('drops one addressed to an address that has since been corrected, one that went stale, and one whose lead is gone', async () => {
      const wrongAddress = fakeDb([nurture({ payload: { category: 'nurture', to: { email: 'typo@example.com' } } })], [lead]);
      expect(await deliverPending(wrongAddress.db)).toMatchObject({ cancelled: 1 });
      expect(String(wrongAddress.patches[0]!.patch.last_error)).toContain('corrected');

      const stale = fakeDb([nurture({ created_at: new Date(Date.now() - 49 * 3_600_000).toISOString() })], [lead]);
      expect(await deliverPending(stale.db)).toMatchObject({ cancelled: 1 });
      expect(String(stale.patches[0]!.patch.last_error)).toContain('stale');

      const orphan = fakeDb([nurture()], []);
      expect(await deliverPending(orphan.db)).toMatchObject({ cancelled: 1 });
      expect(calls).toHaveLength(0);
    });

    it('leaves transactional emails alone: a booking confirmation still goes to someone who unsubscribed', async () => {
      const tx = ev({ id: 't1', channel: 'email', type: 'email.send', payload: { category: 'transactional', to: { email: 'anna@example.com' } } });
      const { db } = fakeDb([tx], [{ ...lead, unsubscribed_at: '2026-10-02T00:00:00Z' }]);
      expect(await deliverPending(db)).toMatchObject({ sent: 1, cancelled: 0 });
    });
  });
});
