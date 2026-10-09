import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverPending, MAX_ATTEMPTS } from './dispatch';
import type { Db, EventRow } from './types';

const ev = (o: Partial<EventRow>): EventRow => ({
  id: 'e1', type: 'lead.created', channel: 'crm', lead_id: 'l1', payload: { a: 1 }, dedupe_key: null, status: 'processing',
  attempts: 1, next_attempt_at: new Date().toISOString(), locked_at: null, last_error: null, created_at: '2026-10-01T00:00:00Z', delivered_at: null, ...o,
});

function fakeDb(events: EventRow[]) {
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const db = {
    rpc: async () => ({ data: events, error: null }),
    from: () => ({ update: (patch: Record<string, unknown>) => ({ eq: async (_c: string, id: string) => { patches.push({ id, patch }); return { error: null }; } }) }),
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
    expect(await deliverPending(db)).toEqual({ claimed: 0, sent: 0, failed: 0, dead: 0, skipped: 'no_webhook' });
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
});
