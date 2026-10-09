import { createAdminSupabase } from '@dpl/db/admin';
import type { Db, LeadRow } from '@dpl/db/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanupLeads, loadLocalEnv, makeLead } from './test-env';

vi.mock('server-only', () => ({}));

const hasDb = loadLocalEnv();
const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Nurture email 3 ("your call has not been booked yet") and the life of a booking: a call that is booked or was held
 * skips it, a cancelled one does not (it means there is no call).
 */
describe.skipIf(!hasDb)('nurture email 3 and bookings (local Supabase)', () => {
  let db: Db;
  let drip: typeof import('./drip');
  const created: string[] = [];

  beforeAll(async () => {
    db = createAdminSupabase();
    drip = await import('./drip');
  });
  afterAll(async () => {
    await cleanupLeads(db, created);
  });

  /** a lead on day 3 whose emails 1 and 2 went out, with one booking in the given state */
  const dayThreeLead = async (
    status: 'confirmed' | 'completed' | 'cancelled',
    now: Date,
  ): Promise<LeadRow> => {
    const l = await makeLead(db, { createdAt: new Date(now.getTime() - 3 * DAY - HOUR) });
    created.push(l.id);
    for (const [number, at] of [
      [1, new Date(l.created_at)],
      [2, new Date(now.getTime() - DAY - HOUR)],
    ] as const) {
      const { error } = await db.from('email_sequence_state').insert({
        lead_id: l.id,
        number,
        status: 'sent',
        scheduled_for: at.toISOString(),
        created_at: at.toISOString(),
      });
      expect(error).toBeNull();
    }
    const starts = new Date(
      now.getTime() + (status === 'confirmed' || status === 'cancelled' ? 2 * DAY : -DAY),
    );
    const { error } = await db.from('bookings').insert({
      lead_id: l.id,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 20 * 60_000).toISOString(),
      status,
      cancelled_at: status === 'cancelled' ? now.toISOString() : null,
    });
    expect(error).toBeNull();
    return l;
  };
  const three = async (l: LeadRow) =>
    (await db.from('email_sequence_state').select('*').eq('lead_id', l.id).eq('number', 3).maybeSingle())
      .data;

  it('a cancelled booking does not count: email 3 goes out', async () => {
    const now = new Date();
    const l = await dayThreeLead('cancelled', now);
    expect(await drip.scheduleDueEmails(db, now, { onlyLeadIds: [l.id] })).toMatchObject({
      scheduled: 1,
      skipped: 0,
      errors: 0,
    });
    expect(await three(l)).toMatchObject({ status: 'queued' });
    const { data: events } = await db.from('events').select('payload').eq('dedupe_key', `welcome:${l.id}:3`);
    expect((events?.[0]?.payload as { template: string }).template).toBe('welcome-3');
  });

  it('a booked call, or one that was held, skips it', async () => {
    const now = new Date();
    for (const status of ['confirmed', 'completed'] as const) {
      const l = await dayThreeLead(status, now);
      expect(await drip.scheduleDueEmails(db, now, { onlyLeadIds: [l.id] }), status).toMatchObject({
        scheduled: 0,
        skipped: 1,
      });
      expect(await three(l), status).toMatchObject({ status: 'skipped', reason: 'already_booked' });
    }
  });
});
