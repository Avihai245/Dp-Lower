import { describe, expect, it } from 'vitest';
import { formatClock, formatLongDate, formatShortDate, formatSlotDate } from './format';

describe('portal date formats', () => {
  it('writes day before month in English, like the prototype', () => {
    expect(formatShortDate('2026-04-18T10:00:00Z', 'en')).toBe('18 Apr');
    expect(formatLongDate('2026-04-12T10:00:00Z', 'en')).toBe('12 April 2026');
  });

  it('names the consultation slot the way the booking screen does', () => {
    expect(formatSlotDate('2026-04-14T10:00:00Z', 'en', 'Asia/Jerusalem')).toBe('Tue Apr 14');
  });

  it('uses the time zone it is given, so the same instant can land on two different days', () => {
    // 22:30 UTC is already the next morning in Jerusalem (UTC+3 in April) and still the evening in New York
    expect(formatShortDate('2026-04-17T22:30:00Z', 'en', 'Asia/Jerusalem')).toBe('18 Apr');
    expect(formatShortDate('2026-04-17T22:30:00Z', 'en', 'America/New_York')).toBe('17 Apr');
    expect(formatShortDate('2026-04-17T22:30:00Z', 'en')).toBe('18 Apr');
  });

  it('falls back to the firm time zone for an unknown zone and to an empty string for a bad date', () => {
    expect(formatShortDate('2026-04-17T22:30:00Z', 'en', 'Mars/Olympus')).toBe('18 Apr');
    expect(formatShortDate('not a date', 'en')).toBe('');
    expect(formatLongDate('', 'he')).toBe('');
    expect(formatSlotDate('nope', 'en')).toBe('');
  });

  it('formats Hebrew dates with Western digits', () => {
    expect(formatShortDate('2026-04-18T10:00:00Z', 'he')).toMatch(/^18 /);
    expect(formatLongDate('2026-04-12T10:00:00Z', 'he')).toContain('2026');
    expect(formatSlotDate('2026-04-14T10:00:00Z', 'he')).toMatch(/14/);
  });

  it('formats a 24-hour clock', () => {
    const d = new Date(2026, 3, 18, 9, 5);
    expect(formatClock(d, 'en')).toBe('09:05');
    expect(formatClock(new Date(2026, 3, 18, 18, 40), 'he')).toBe('18:40');
  });
});
