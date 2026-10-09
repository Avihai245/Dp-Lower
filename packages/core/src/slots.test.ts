import { describe, expect, it } from 'vitest';
import { computeAvailability, isSlotAvailable, seatsLeft, type SlotRule } from './slots';

const TIMES = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
const rules: SlotRule[] = [0, 1, 2, 3, 4].flatMap((weekday) => TIMES.map((startTime) => ({ weekday, startTime, capacity: 2 })));

describe('computeAvailability', () => {
  // Friday 9 Oct 2026, 12:00 UTC (15:00 in Jerusalem): Friday and Saturday have no slots
  const now = new Date('2026-10-09T12:00:00Z');

  it('returns the next five working days (Sunday to Thursday) with all six slots', () => {
    const days = computeAvailability({ now, rules, exceptions: [], bookedStarts: [] });
    expect(days.map((d) => d.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(days.every((d) => d.slots.length === 6)).toBe(true);
    expect(days[0]!.slots[0]).toEqual({ startsAt: '2026-10-11T06:00:00.000Z', firmTime: '09:00', remaining: 2 });
  });

  it('hides full slots and keeps partially booked ones with fewer seats', () => {
    const full = '2026-10-11T06:00:00.000Z';
    const half = '2026-10-11T07:30:00.000Z';
    const days = computeAvailability({ now, rules, exceptions: [], bookedStarts: [full, full, half] });
    const sunday = days[0]!;
    expect(sunday.slots.find((s) => s.startsAt === full)).toBeUndefined();
    expect(sunday.slots.find((s) => s.startsAt === half)?.remaining).toBe(1);
    expect(isSlotAvailable(days, half)).toBe(true);
    expect(isSlotAvailable(days, full)).toBe(false);
  });

  it('applies the notice window on the same day', () => {
    // Thursday 15 Oct 2026, 11:00 UTC = 14:00 in Jerusalem; with 2h notice only 17:00 is left today
    const days = computeAvailability({ now: new Date('2026-10-15T11:00:00Z'), rules, exceptions: [], bookedStarts: [] });
    expect(days[0]!.date).toBe('2026-10-15');
    expect(days[0]!.slots.map((s) => s.firmTime)).toEqual(['17:00']);
    expect(days[1]!.date).toBe('2026-10-18');
  });

  it('skips blocked days and blocked slots', () => {
    const days = computeAvailability({
      now,
      rules,
      exceptions: [
        { onDate: '2026-10-12', startTime: null },
        { onDate: '2026-10-11', startTime: '09:00:00' },
      ],
      bookedStarts: [],
    });
    expect(days.map((d) => d.date)).not.toContain('2026-10-12');
    expect(days[0]!.slots.map((s) => s.firmTime)).not.toContain('09:00');
    expect(days).toHaveLength(5);
  });

  it('uses winter-time offsets after the clocks change', () => {
    const days = computeAvailability({ now: new Date('2026-10-23T12:00:00Z'), rules, exceptions: [], bookedStarts: [] });
    const sun25 = days.find((d) => d.date === '2026-10-25')!;
    expect(sun25.slots[0]!.startsAt).toBe('2026-10-25T07:00:00.000Z'); // 09:00 IST = 07:00Z
  });

  it('counts remaining seats', () => {
    const days = computeAvailability({ now, rules, exceptions: [], bookedStarts: [] });
    expect(seatsLeft(days)).toBe(5 * 6 * 2);
  });

  it('returns nothing without rules', () => {
    expect(computeAvailability({ now, rules: [], exceptions: [], bookedStarts: [] })).toEqual([]);
  });
});
