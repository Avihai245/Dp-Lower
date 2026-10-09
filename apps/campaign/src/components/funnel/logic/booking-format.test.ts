import { isValidTimeZone } from '@dpl/core';
import { describe, expect, it } from 'vitest';
import { SEATS_LINE_MAX, dayLabel, showSeatsLine, slotLabel, timeLabel, visitorTimeZone, weekdayLabel, whenLabel } from './booking-format';

// 09:00 in Jerusalem (UTC+3 in October) on Monday 12 October 2026
const MON_0900_IL = '2026-10-12T06:00:00.000Z';
// 17:00 in Jerusalem
const MON_1700_IL = '2026-10-12T14:00:00.000Z';

describe('booking formatting', () => {
  describe('timeLabel', () => {
    it('writes English times as designed: "9:00 am", "12:00 pm", "5:00 pm"', () => {
      expect(timeLabel(MON_0900_IL, 'Asia/Jerusalem', 'en')).toBe('9:00 am');
      expect(timeLabel('2026-10-12T09:00:00.000Z', 'Asia/Jerusalem', 'en')).toBe('12:00 pm');
      expect(timeLabel(MON_1700_IL, 'Asia/Jerusalem', 'en')).toBe('5:00 pm');
      expect(timeLabel('2026-10-12T07:30:00.000Z', 'Asia/Jerusalem', 'en')).toBe('10:30 am');
    });
    it('uses 24-hour time in Hebrew', () => {
      expect(timeLabel(MON_0900_IL, 'Asia/Jerusalem', 'he')).toBe('09:00');
      expect(timeLabel(MON_1700_IL, 'Asia/Jerusalem', 'he')).toBe('17:00');
    });
    it('shows the same instant in the visitor zone', () => {
      expect(timeLabel('2026-10-12T09:00:00.000Z', 'America/New_York', 'en')).toBe('5:00 am');
      expect(timeLabel('2026-10-12T09:00:00.000Z', 'Europe/London', 'en')).toBe('10:00 am');
      // clocks change on 25 October in Israel: the same firm time is a different UTC instant afterwards
      expect(timeLabel('2026-10-26T07:00:00.000Z', 'Asia/Jerusalem', 'en')).toBe('9:00 am');
    });
    it('midnight and noon read right', () => {
      expect(timeLabel('2026-10-12T21:00:00.000Z', 'Asia/Jerusalem', 'en')).toBe('12:00 am');
      expect(timeLabel('2026-10-12T09:00:00.000Z', 'Asia/Jerusalem', 'en')).toBe('12:00 pm');
    });
  });

  describe('dayLabel', () => {
    it('labels a firm-zone date independently of the machine zone', () => {
      expect(dayLabel('2026-10-12', 'en')).toEqual({ dow: 'Mon', day: '12', mon: 'Oct' });
      expect(dayLabel('2026-10-11', 'en')).toEqual({ dow: 'Sun', day: '11', mon: 'Oct' });
      expect(dayLabel('2026-12-31', 'en')).toEqual({ dow: 'Thu', day: '31', mon: 'Dec' });
    });
    it('is in Hebrew for Hebrew', () => {
      const l = dayLabel('2026-10-12', 'he');
      expect(l.day).toBe('12');
      expect(l.dow).toMatch(/[֐-׿]/);
      expect(l.mon).toMatch(/[֐-׿]/);
    });
  });

  describe('slotLabel', () => {
    it('is just the time when the visitor is on the same calendar day as the firm', () => {
      expect(slotLabel(MON_1700_IL, '2026-10-12', 'America/New_York', 'en')).toBe('10:00 am');
      expect(slotLabel(MON_0900_IL, '2026-10-12', 'Asia/Jerusalem', 'en')).toBe('9:00 am');
    });
    it('adds the weekday when the visitor is already on the next day, so nobody calls in on the wrong day', () => {
      // 17:00 in Jerusalem is 01:00 the next morning in Sydney (UTC+11 in October)
      expect(slotLabel(MON_1700_IL, '2026-10-12', 'Australia/Sydney', 'en')).toBe('1:00 am · Tue');
    });
    it('adds the weekday when the visitor is still on the previous day', () => {
      // 09:00 Monday in Jerusalem is Sunday evening in Honolulu (UTC-10)
      expect(slotLabel(MON_0900_IL, '2026-10-12', 'Pacific/Honolulu', 'en')).toBe('8:00 pm · Sun');
    });
  });

  describe('whenLabel', () => {
    it('reads like the prototype: "Mon Oct 12" and "5:00 am"', () => {
      expect(whenLabel('2026-10-12T09:00:00.000Z', 'America/New_York', 'en')).toEqual({ date: 'Mon Oct 12', time: '5:00 am' });
      expect(whenLabel(MON_0900_IL, 'Asia/Jerusalem', 'en')).toEqual({ date: 'Mon Oct 12', time: '9:00 am' });
    });
    it('follows the visitor zone across midnight', () => {
      expect(whenLabel(MON_1700_IL, 'Australia/Sydney', 'en')).toEqual({ date: 'Tue Oct 13', time: '1:00 am' });
    });
    it('is Hebrew for Hebrew', () => {
      const w = whenLabel(MON_0900_IL, 'Asia/Jerusalem', 'he');
      expect(w.time).toBe('09:00');
      expect(w.date).toMatch(/[֐-׿]/);
      expect(w.date).toContain('12');
    });
  });

  it('weekdayLabel is the short weekday in the given zone', () => {
    expect(weekdayLabel(MON_1700_IL, 'Australia/Sydney', 'en')).toBe('Tue');
  });

  describe('the "calls left" line', () => {
    it('is shown only when the real number is low, never for a big number or none', () => {
      expect(SEATS_LINE_MAX).toBe(6);
      expect([0, 1, 2, 6].map(showSeatsLine)).toEqual([false, true, true, true]);
      expect([7, 12, 60].map(showSeatsLine)).toEqual([false, false, false]);
    });
  });

  it('visitorTimeZone is always a valid IANA zone', () => {
    expect(isValidTimeZone(visitorTimeZone())).toBe(true);
  });
});
