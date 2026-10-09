import { describe, expect, it } from 'vitest';
import { formatCall, formatClock, formatDate, formatDateTime, formatDay, formatRel, initials, isolate, weekdayName } from './format';

const NOW = new Date('2026-10-09T12:00:00Z');
const t = (key: string, v?: Record<string, string | number>) => `${key}${v ? JSON.stringify(v) : ''}`;
const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('time formatting (always the firm\'s time zone, Asia/Jerusalem)', () => {
  it('shows clock times in Jerusalem time, winter and summer', () => {
    expect(formatClock('2026-11-18T01:00:00Z', 'en')).toBe('03:00'); // UTC+2
    expect(formatClock('2026-07-01T01:00:00Z', 'en')).toBe('04:00'); // UTC+3 (summer time)
    expect(formatClock('2026-11-18T22:30:00Z', 'he')).toBe('00:30'); // next day in Jerusalem
  });

  it('shows the Jerusalem calendar day, not the UTC one', () => {
    expect(formatDay('2026-11-18T22:30:00Z', 'en')).toBe('Nov 19');
    expect(formatDateTime('2026-11-18T22:30:00Z', 'en')).toBe('Nov 19, 00:30');
  });

  it('formats a call with weekday, day and time', () => {
    expect(formatCall('2026-11-18T07:00:00Z', 'en')).toContain('Wed');
    expect(formatCall('2026-11-18T07:00:00Z', 'en')).toContain('09:00');
  });

  it('formats a calendar date without shifting it', () => {
    expect(formatDate('2031-01-05', 'en')).toBe('Sun, Jan 5, 2031');
    expect(formatDate('2031-01-05', 'he')).toContain('2031');
  });

  it('names the weekdays in both languages (0 = Sunday)', () => {
    expect([0, 1, 4, 6].map((d) => weekdayName(d, 'en'))).toEqual(['Sunday', 'Monday', 'Thursday', 'Saturday']);
    expect(weekdayName(0, 'he')).toBe('יום ראשון');
    expect(weekdayName(6, 'he')).toBe('יום שבת');
  });
});

describe('relative time', () => {
  it('maps the distance to the message keys, with a long form for the lead page', () => {
    expect(formatRel(t, 'en', at(0), NOW)).toBe('time.now');
    expect(formatRel(t, 'en', at(5), NOW)).toBe('time.min{"n":5}');
    expect(formatRel(t, 'en', at(180), NOW)).toBe('time.hour{"n":3}');
    expect(formatRel(t, 'en', at(24 * 60), NOW)).toBe('time.yesterday');
    expect(formatRel(t, 'en', at(3 * 24 * 60), NOW)).toBe('time.day{"n":3}');
    expect(formatRel(t, 'en', at(3 * 24 * 60), NOW, { long: true })).toBe('time.longDay{"n":3}');
    expect(formatRel(t, 'en', at(14 * 24 * 60), NOW)).toBe('time.week{"n":2}');
    expect(formatRel(t, 'en', at(14 * 24 * 60), NOW, { long: true })).toBe('time.longWeek{"n":2}');
  });
  it('falls back to a date after about five weeks', () => {
    expect(formatRel(t, 'en', '2026-06-01T10:00:00Z', NOW)).toBe('Jun 1');
  });
});

describe('small helpers', () => {
  it('makes initials from a name, in any script', () => {
    expect(initials('Anna Reinhardt')).toBe('AR');
    expect(initials('  dr. anna  maria reinhardt ')).toBe('DA');
    expect(initials('דנה כהן')).toBe('דכ');
    expect(initials('')).toBe('·');
    expect(initials(null)).toBe('·');
  });
  it('wraps a value in bidi isolates for Hebrew sentences', () => {
    expect(isolate('DPL-26-1001')).toBe('⁨DPL-26-1001⁩');
    expect(isolate(5)).toBe('⁨5⁩');
  });
});
