import { describe, expect, it } from 'vitest';
import { addDays, isValidTimeZone, weekdayOfDate, zonedParts, zonedTimeToUtc } from './timezone';

describe('zonedTimeToUtc', () => {
  const tz = 'Asia/Jerusalem';
  it('applies summer time (UTC+3) in October before the change', () => {
    expect(zonedTimeToUtc('2026-10-22', '10:30', tz).toISOString()).toBe('2026-10-22T07:30:00.000Z');
  });
  it('applies winter time (UTC+2) after the clocks go back on 25 Oct 2026', () => {
    expect(zonedTimeToUtc('2026-10-25', '10:30', tz).toISOString()).toBe('2026-10-25T08:30:00.000Z');
  });
  it('handles the spring change (27 Mar 2026)', () => {
    expect(zonedTimeToUtc('2026-03-26', '10:30', tz).toISOString()).toBe('2026-03-26T08:30:00.000Z');
    expect(zonedTimeToUtc('2026-03-29', '10:30', tz).toISOString()).toBe('2026-03-29T07:30:00.000Z');
  });
  it('round-trips through zonedParts', () => {
    const d = zonedTimeToUtc('2026-12-01', '17:00', tz);
    const p = zonedParts(d, tz);
    expect([p.date, p.time]).toEqual(['2026-12-01', '17:00']);
  });
  it('works for other zones', () => {
    expect(zonedTimeToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
  });
});

describe('calendar helpers', () => {
  it('computes weekdays and day arithmetic across month ends', () => {
    expect(weekdayOfDate('2026-10-11')).toBe(0); // Sunday
    expect(weekdayOfDate('2026-10-09')).toBe(5); // Friday
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('validates time zones', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
