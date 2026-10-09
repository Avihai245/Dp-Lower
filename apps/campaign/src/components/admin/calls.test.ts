import { describe, expect, it } from 'vitest';
import { callActions, callPhase, pickCall, type CallRow } from './calls';

const now = new Date('2026-10-11T09:00:00Z');
const row = (o: Partial<CallRow> & Pick<CallRow, 'id' | 'starts_at'>): CallRow => ({
  ends_at: new Date(new Date(o.starts_at).getTime() + 20 * 60_000).toISOString(),
  status: 'confirmed',
  timezone: 'Europe/London',
  lawyer: null,
  ...o,
});

describe('pickCall', () => {
  it('shows the upcoming call with its lawyer', () => {
    const call = pickCall(
      [
        row({ id: 'old', starts_at: '2026-10-01T09:00:00Z', status: 'completed' }),
        row({
          id: 'next',
          starts_at: '2026-10-12T09:00:00Z',
          lawyer: { user_id: 'l1', full_name: 'Dana Levi' },
        }),
      ],
      now,
    );
    expect(call).toEqual({
      id: 'next',
      startsAt: '2026-10-12T09:00:00Z',
      endsAt: '2026-10-12T09:20:00.000Z',
      status: 'confirmed',
      upcoming: true,
      started: false,
      timezone: 'Europe/London',
      lawyer: { id: 'l1', name: 'Dana Levi' },
    });
  });

  it('never shows a confirmed call whose time has passed as upcoming', () => {
    const call = pickCall([row({ id: 'past', starts_at: '2026-10-10T09:00:00Z' })], now)!;
    expect(call).toMatchObject({ id: 'past', status: 'confirmed', upcoming: false, started: true });
    expect(callPhase(call)).toBe('awaiting');
  });

  it('a call under way is still upcoming (it can be cancelled) and has started (it can be marked)', () => {
    const call = pickCall([row({ id: 'now', starts_at: '2026-10-11T08:50:00Z' })], now)!;
    expect(call).toMatchObject({ upcoming: true, started: true });
    expect(callActions(call)).toEqual(['held', 'no_show', 'cancel']);
  });

  it('a call marked held or no-show stays on the page while its slot is still running, and can be corrected', () => {
    for (const status of ['completed', 'no_show'] as const) {
      const call = pickCall([row({ id: 'running', starts_at: '2026-10-11T08:50:00Z', status })], now)!;
      expect(call, status).toMatchObject({ id: 'running', status, upcoming: false, started: true });
      expect(callPhase(call)).toBe(status === 'completed' ? 'held' : 'no_show');
      expect(callActions(call)).toEqual(status === 'completed' ? ['no_show'] : ['held']);
    }
  });

  it('otherwise the latest call whose time has come; cancelled ones are not shown', () => {
    const rows = [
      row({ id: 'a', starts_at: '2026-10-01T09:00:00Z', status: 'completed' }),
      row({ id: 'b', starts_at: '2026-10-05T09:00:00Z', status: 'no_show' }),
      row({ id: 'c', starts_at: '2026-10-09T09:00:00Z', status: 'cancelled' }),
    ];
    expect(pickCall(rows, now)?.id).toBe('b');
    expect(pickCall([rows[2]!], now)).toBeNull();
    expect(pickCall([], now)).toBeNull();
  });
});

describe('what the team can do with a call', () => {
  const base = { id: 'x', startsAt: '', endsAt: '', timezone: null, lawyer: null };
  it('a booked call that has not started can only be cancelled', () => {
    const c = { ...base, status: 'confirmed' as const, upcoming: true, started: false };
    expect(callActions(c)).toEqual(['cancel']);
    expect(callPhase(c)).toBe('booked');
  });
  it('a past call is marked held or a no-show, and each corrects the other', () => {
    expect(callActions({ ...base, status: 'confirmed', upcoming: false, started: true })).toEqual([
      'held',
      'no_show',
    ]);
    const held = { ...base, status: 'completed' as const, upcoming: false, started: true };
    expect(callActions(held)).toEqual(['no_show']);
    expect(callPhase(held)).toBe('held');
    const noShow = { ...base, status: 'no_show' as const, upcoming: false, started: true };
    expect(callActions(noShow)).toEqual(['held']);
    expect(callPhase(noShow)).toBe('no_show');
  });
});
