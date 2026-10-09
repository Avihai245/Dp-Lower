import { describe, expect, it } from 'vitest';
import { computeAvailability, isSlotAvailable, seatsLeft, type BookedSeat, type SlotRule } from './slots';
import { zonedParts } from './timezone';

const TIMES = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
const rules: SlotRule[] = [0, 1, 2, 3, 4].flatMap((weekday) => TIMES.map((startTime) => ({ weekday, startTime, capacity: 2 })));
/** seats of the unassigned template */
const pooled = (...starts: string[]): BookedSeat[] => starts.map((startsAt) => ({ startsAt, staffId: null }));

describe('computeAvailability', () => {
  // Friday 9 Oct 2026, 12:00 UTC (15:00 in Jerusalem): Friday and Saturday have no slots
  const now = new Date('2026-10-09T12:00:00Z');

  it('returns the next five working days (Sunday to Thursday) with all six slots', () => {
    const days = computeAvailability({ now, rules, exceptions: [], bookings: [] });
    expect(days.map((d) => d.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(days.every((d) => d.slots.length === 6)).toBe(true);
    expect(days[0]!.slots[0]).toEqual({ startsAt: '2026-10-11T06:00:00.000Z', firmTime: '09:00', remaining: 2 });
  });

  it('hides full slots and keeps partially booked ones with fewer seats', () => {
    const full = '2026-10-11T06:00:00.000Z';
    const half = '2026-10-11T07:30:00.000Z';
    const days = computeAvailability({ now, rules, exceptions: [], bookings: pooled(full, full, half) });
    const sunday = days[0]!;
    expect(sunday.slots.find((s) => s.startsAt === full)).toBeUndefined();
    expect(sunday.slots.find((s) => s.startsAt === half)?.remaining).toBe(1);
    expect(isSlotAvailable(days, half)).toBe(true);
    expect(isSlotAvailable(days, full)).toBe(false);
  });

  it('applies the notice window on the same day', () => {
    // Thursday 15 Oct 2026, 11:00 UTC = 14:00 in Jerusalem; with 2h notice only 17:00 is left today
    const days = computeAvailability({ now: new Date('2026-10-15T11:00:00Z'), rules, exceptions: [], bookings: [] });
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
      bookings: [],
    });
    expect(days.map((d) => d.date)).not.toContain('2026-10-12');
    expect(days[0]!.slots.map((s) => s.firmTime)).not.toContain('09:00');
    expect(days).toHaveLength(5);
  });

  it('uses winter-time offsets after the clocks change', () => {
    const days = computeAvailability({ now: new Date('2026-10-23T12:00:00Z'), rules, exceptions: [], bookings: [] });
    const sun25 = days.find((d) => d.date === '2026-10-25')!;
    expect(sun25.slots[0]!.startsAt).toBe('2026-10-25T07:00:00.000Z'); // 09:00 IST = 07:00Z
  });

  it('counts remaining seats', () => {
    const days = computeAvailability({ now, rules, exceptions: [], bookings: [] });
    expect(seatsLeft(days)).toBe(5 * 6 * 2);
  });

  it('returns nothing without rules', () => {
    expect(computeAvailability({ now, rules: [], exceptions: [], bookings: [] })).toEqual([]);
  });

  it('stops after the horizon and looks no further than the lookahead', () => {
    expect(computeAvailability({ now, rules, exceptions: [], bookings: [], horizonDays: 2 }).map((d) => d.date)).toEqual([
      '2026-10-11',
      '2026-10-12',
    ]);
    // three days ahead (Fri, Sat, Sun): only Sunday has hours
    expect(computeAvailability({ now, rules, exceptions: [], bookings: [], lookaheadDays: 3 }).map((d) => d.date)).toEqual([
      '2026-10-11',
    ]);
  });
});

describe('computeAvailability with lawyers', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const ANNA = '0b6c2d60-0000-4000-8000-00000000000a';
  const BEN = '0b6c2d60-0000-4000-8000-00000000000b';
  const lawyer = (staffId: string, weekday: number, startTime: string): SlotRule => ({ weekday, startTime, capacity: 1, staffId });
  // Sunday 11 Oct 2026: 10:00 and 11:00 in Jerusalem (summer time, UTC+3)
  const TEN = '2026-10-11T07:00:00.000Z';
  const ELEVEN = '2026-10-11T08:00:00.000Z';
  const sunday = (days: ReturnType<typeof computeAvailability>) => days.find((d) => d.date === '2026-10-11');

  it('offers a lawyer’s own hours, one call at a time', () => {
    const days = computeAvailability({ now, rules: [lawyer(ANNA, 0, '10:00')], exceptions: [], bookings: [], lawyers: [ANNA], horizonDays: 1 });
    expect(days).toHaveLength(1);
    expect(days[0]!.slots).toEqual([{ startsAt: TEN, firmTime: '10:00', remaining: 1 }]);
  });

  it('adds up two lawyers who offer the same time, and keeps the slot while one of them is free', () => {
    const r = [lawyer(ANNA, 0, '10:00'), lawyer(BEN, 0, '10:00')];
    const lawyers = [ANNA, BEN];
    expect(sunday(computeAvailability({ now, rules: r, exceptions: [], bookings: [], lawyers }))!.slots[0]!.remaining).toBe(2);
    const oneTaken = computeAvailability({ now, rules: r, exceptions: [], bookings: [{ startsAt: TEN, staffId: ANNA }], lawyers });
    expect(sunday(oneTaken)!.slots[0]!.remaining).toBe(1);
    const bothTaken = computeAvailability({
      now,
      rules: r,
      exceptions: [],
      bookings: [
        { startsAt: TEN, staffId: ANNA },
        { startsAt: TEN, staffId: BEN },
      ],
      lawyers,
    });
    expect(sunday(bothTaken)).toBeUndefined();
  });

  it('hides a fully booked lawyer, and only that lawyer', () => {
    const r = [lawyer(ANNA, 0, '10:00'), lawyer(ANNA, 0, '11:00'), lawyer(BEN, 0, '11:00')];
    const days = computeAvailability({
      now,
      rules: r,
      exceptions: [],
      bookings: [
        { startsAt: TEN, staffId: ANNA },
        { startsAt: ELEVEN, staffId: ANNA },
      ],
      lawyers: [ANNA, BEN],
    });
    expect(sunday(days)!.slots).toEqual([{ startsAt: ELEVEN, firmTime: '11:00', remaining: 1 }]);
  });

  it('a lawyer’s day off removes only their seats; a day closed for everyone removes all', () => {
    const r = [lawyer(ANNA, 0, '10:00'), lawyer(BEN, 0, '10:00'), { weekday: 0, startTime: '10:00', capacity: 2 }];
    const input = { now, rules: r, bookings: [], lawyers: [ANNA, BEN] };
    expect(sunday(computeAvailability({ ...input, exceptions: [] }))!.slots[0]!.remaining).toBe(4);
    // Anna away all day, Ben away for that slot
    const away = computeAvailability({
      ...input,
      exceptions: [
        { onDate: '2026-10-11', startTime: null, staffId: ANNA },
        { onDate: '2026-10-11', startTime: '10:00:00', staffId: BEN },
      ],
    });
    expect(sunday(away)!.slots[0]!.remaining).toBe(2);
    // closed for everyone: the whole day, or the one slot
    expect(sunday(computeAvailability({ ...input, exceptions: [{ onDate: '2026-10-11', startTime: null }] }))).toBeUndefined();
    expect(sunday(computeAvailability({ ...input, exceptions: [{ onDate: '2026-10-11', startTime: '10:00', staffId: null }] }))).toBeUndefined();
    // a lawyer's day off on another date changes nothing
    expect(sunday(computeAvailability({ ...input, exceptions: [{ onDate: '2026-10-12', startTime: null, staffId: ANNA }] }))!.slots[0]!.remaining).toBe(4);
  });

  it('counts the template and the lawyers separately: a lawyer’s call never takes a template seat', () => {
    const r = [lawyer(ANNA, 0, '10:00'), { weekday: 0, startTime: '10:00', capacity: 2 }];
    const days = computeAvailability({
      now,
      rules: r,
      exceptions: [],
      bookings: [{ startsAt: TEN, staffId: ANNA }, ...pooled(TEN)],
      lawyers: [ANNA],
    });
    expect(sunday(days)!.slots[0]!.remaining).toBe(1);
    const full = computeAvailability({ now, rules: r, exceptions: [], bookings: [{ startsAt: TEN, staffId: ANNA }, ...pooled(TEN, TEN)], lawyers: [ANNA] });
    expect(sunday(full)).toBeUndefined();
    expect(seatsLeft(computeAvailability({ now, rules: r, exceptions: [], bookings: [], lawyers: [ANNA], horizonDays: 1 }))).toBe(3);
  });

  it('leaves out a lawyer who no longer takes calls, and their bookings take no template seat', () => {
    const r = [lawyer(ANNA, 0, '10:00'), lawyer(BEN, 0, '11:00'), { weekday: 0, startTime: '11:00', capacity: 1 }];
    const days = computeAvailability({ now, rules: r, exceptions: [], bookings: [{ startsAt: ELEVEN, staffId: BEN }], lawyers: [ANNA] });
    expect(sunday(days)!.slots).toEqual([
      { startsAt: TEN, firmTime: '10:00', remaining: 1 },
      { startsAt: ELEVEN, firmTime: '11:00', remaining: 1 },
    ]);
    // without a list every lawyer in the rules counts
    expect(sunday(computeAvailability({ now, rules: r, exceptions: [], bookings: [] }))!.slots[1]!.remaining).toBe(2);
  });

  it('ignores switched-off hours and gives a lawyer one seat whatever the stored capacity', () => {
    const r: SlotRule[] = [
      { ...lawyer(ANNA, 0, '10:00'), active: false },
      { ...lawyer(BEN, 0, '10:00'), capacity: 5 },
    ];
    expect(sunday(computeAvailability({ now, rules: r, exceptions: [], bookings: [], lawyers: [ANNA, BEN] }))!.slots[0]!.remaining).toBe(1);
  });

  it('applies the notice window to lawyers’ hours as well', () => {
    // Sunday 11 Oct, 06:30 UTC = 09:30 in Jerusalem: 10:00 and 11:00 are inside the two hours of notice
    const days = computeAvailability({
      now: new Date('2026-10-11T06:30:00Z'),
      rules: [lawyer(ANNA, 0, '10:00'), lawyer(ANNA, 0, '11:00'), lawyer(ANNA, 0, '12:00')],
      exceptions: [],
      bookings: [],
      lawyers: [ANNA],
    });
    expect(days[0]!.date).toBe('2026-10-11');
    expect(days[0]!.slots.map((s) => s.firmTime)).toEqual(['12:00']);
  });
});

describe('computeAvailability around the clock changes in Asia/Jerusalem', () => {
  const ANNA = '0b6c2d60-0000-4000-8000-00000000000a';

  it('autumn (Sunday 25 Oct 2026, 02:00 back to 01:00): the same wall-clock hours, one hour later in UTC', () => {
    const days = computeAvailability({
      now: new Date('2026-10-22T12:00:00Z'),
      rules: [0, 4].flatMap((weekday) => [{ weekday, startTime: '01:30', capacity: 1 }, { weekday, startTime: '04:10', capacity: 1, staffId: ANNA }]),
      exceptions: [],
      bookings: [],
      lawyers: [ANNA],
      horizonDays: 3,
    });
    const sun = days.find((d) => d.date === '2026-10-25')!;
    // 01:30 happens twice that night; it is offered once, as a real instant whose wall clock reads 01:30
    expect(zonedParts(new Date(sun.slots[0]!.startsAt), 'Asia/Jerusalem').time).toBe('01:30');
    expect(sun.slots[1]).toEqual({ startsAt: '2026-10-25T02:10:00.000Z', firmTime: '04:10', remaining: 1 }); // UTC+2
    const thu = days.find((d) => d.date === '2026-10-29')!;
    expect(thu.slots[1]!.startsAt).toBe('2026-10-29T02:10:00.000Z');
    const before = computeAvailability({ now: new Date('2026-10-20T12:00:00Z'), rules: [{ weekday: 4, startTime: '04:10', capacity: 1 }], exceptions: [], bookings: [], horizonDays: 1 });
    expect(before[0]).toMatchObject({ date: '2026-10-22', slots: [{ startsAt: '2026-10-22T01:10:00.000Z' }] }); // UTC+3
  });

  it('spring (Friday 27 Mar 2026, 02:00 forward to 03:00): a time that does not exist that day is not offered', () => {
    const days = computeAvailability({
      now: new Date('2026-03-25T12:00:00Z'),
      rules: [5].flatMap((weekday) => [
        { weekday, startTime: '02:30', capacity: 1, staffId: ANNA },
        { weekday, startTime: '03:30', capacity: 1, staffId: ANNA },
      ]),
      exceptions: [],
      bookings: [],
      lawyers: [ANNA],
      horizonDays: 2,
    });
    const fri27 = days.find((d) => d.date === '2026-03-27')!;
    expect(fri27.slots).toEqual([{ startsAt: '2026-03-27T00:30:00.000Z', firmTime: '03:30', remaining: 1 }]);
    // a week later both exist again (summer time, UTC+3)
    expect(days.find((d) => d.date === '2026-04-03')!.slots.map((s) => s.startsAt)).toEqual([
      '2026-04-02T23:30:00.000Z',
      '2026-04-03T00:30:00.000Z',
    ]);
  });

  it('dates are the firm’s calendar dates, whatever the visitor’s zone', () => {
    // Sunday 04:10 in Jerusalem is still Saturday evening in New York: the slot belongs to Sunday's tab
    const days = computeAvailability({
      now: new Date('2026-10-09T12:00:00Z'),
      rules: [{ weekday: 0, startTime: '04:10', capacity: 1, staffId: ANNA }],
      exceptions: [],
      bookings: [],
      lawyers: [ANNA],
      horizonDays: 1,
    });
    expect(days).toEqual([{ date: '2026-10-11', weekday: 0, slots: [{ startsAt: '2026-10-11T01:10:00.000Z', firmTime: '04:10', remaining: 1 }] }]);
    const ny = zonedParts(new Date(days[0]!.slots[0]!.startsAt), 'America/New_York');
    expect([ny.date, ny.time, ny.weekday]).toEqual(['2026-10-10', '21:10', 6]);
  });
});
