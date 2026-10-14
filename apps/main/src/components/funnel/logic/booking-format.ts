import { FIRM_TIMEZONE, isValidTimeZone, zonedParts, type Locale } from '@dpl/core';

/**
 * Formatting for the booking screen. The availability API speaks UTC instants and firm-zone dates; this turns them
 * into what the visitor reads: day tabs from the firm's calendar date, slot buttons in the visitor's own zone.
 */
export const intlLocale = (l: Locale): string => (l === 'he' ? 'he-IL' : 'en-US');

/** The "N free calls left this week" line says what is true: it is shown while there is a free seat left this week. */
export const showSeatsLine = (seatsLeft: number): boolean => seatsLeft > 0;

/** The visitor's IANA time zone, or the firm's when the browser cannot tell. */
export function visitorTimeZone(): string {
  try {
    const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : FIRM_TIMEZONE;
  } catch {
    return FIRM_TIMEZONE;
  }
}

export interface DayLabel {
  /** "Mon" */
  dow: string;
  /** "12" */
  day: string;
  /** "Oct" */
  mon: string;
}

/** Tab label of a firm-zone calendar date ('YYYY-MM-DD'), independent of the visitor's zone. */
export function dayLabel(date: string, locale: Locale): DayLabel {
  const noon = new Date(`${date}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(locale), { ...o, timeZone: 'UTC' }).format(noon);
  return { dow: f({ weekday: 'short' }), day: f({ day: 'numeric' }), mon: f({ month: 'short' }) };
}

/** "9:00 am" / "2:00 pm" in English (as designed), 24-hour "14:00" in Hebrew. */
export function timeLabel(at: string | Date, tz: string, locale: Locale): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  if (locale === 'he') {
    return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
  }
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
}

/** Short weekday in the visitor's zone ("Mon"). */
export function weekdayLabel(at: string | Date, tz: string, locale: Locale): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', timeZone: tz }).format(d);
}

/**
 * Text of a slot button. The tab is a firm-zone date; for a visitor far from Jerusalem the same instant can fall on
 * another calendar day, and then the weekday is added ("1:00 am · Mon") so nobody calls in on the wrong day.
 */
export function slotLabel(startsAt: string, firmDate: string, tz: string, locale: Locale): string {
  const time = timeLabel(startsAt, tz, locale);
  return zonedParts(new Date(startsAt), tz).date === firmDate ? time : `${time} · ${weekdayLabel(startsAt, tz, locale)}`;
}

export interface WhenLabel {
  /** "Mon Oct 12" */
  date: string;
  /** "12:00 pm" */
  time: string;
}

/** A booked call as the visitor reads it, in their own zone. */
export function whenLabel(startsAt: string, tz: string, locale: Locale): WhenLabel {
  const d = new Date(startsAt);
  const time = timeLabel(d, tz, locale);
  if (locale === 'he') {
    return { date: new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(d), time };
  }
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('weekday')} ${get('month')} ${get('day')}`, time };
}
