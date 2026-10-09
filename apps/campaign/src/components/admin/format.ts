import { FIRM_TIMEZONE, initialsOf } from '@dpl/core';
import { relTime } from './model';

/** Date and time helpers for the CRM. Everything is shown in the firm's time zone, in the page language. */

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Wraps a Latin or numeric value (email, phone, case ref, "6/8") in Unicode bidi isolates so it keeps its own direction
 * when it is spliced into a Hebrew sentence. Invisible in English.
 */
export const isolate = (v: string | number): string => `\u2068${v}\u2069`;

const TZ = FIRM_TIMEZONE;

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${locale}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
    cache.set(k, f);
  }
  return f;
}

/** "12 Sep" */
export const formatDay = (iso: string | number | Date, locale: string): string =>
  fmt(locale, 'day', { day: 'numeric', month: 'short' }).format(new Date(iso));

/** "14:05" */
export const formatClock = (iso: string | number | Date, locale: string): string =>
  fmt(locale, 'clock', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** "12 Sep, 14:05" */
export const formatDateTime = (iso: string | number | Date, locale: string): string =>
  `${formatDay(iso, locale)}, ${formatClock(iso, locale)}`;

/** "Sun 12 Oct, 10:30" */
export const formatCall = (iso: string | number | Date, locale: string): string =>
  fmt(locale, 'call', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );

/** A calendar date 'YYYY-MM-DD' (no time zone shifting): "Sun, 12 Oct 2026". */
export const formatDate = (date: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** weekday 0 = Sunday */
export const weekdayName = (weekday: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(2023, 0, 1 + weekday)));

/**
 * "Just now", "5 min ago", "2h ago", "Yesterday", "3d ago", "2w ago", then a date. `long` spells days and weeks out
 * ("3 days ago"), as the lead page does.
 */
export function formatRel(t: Translate, locale: string, iso: string, now: Date, opts: { long?: boolean } = {}): string {
  const r = relTime(new Date(iso).getTime(), now.getTime());
  switch (r.kind) {
    case 'now':
      return t('time.now');
    case 'min':
      return t('time.min', { n: r.n });
    case 'hour':
      return t('time.hour', { n: r.n });
    case 'yesterday':
      return t('time.yesterday');
    case 'day':
      return t(opts.long ? 'time.longDay' : 'time.day', { n: r.n });
    case 'week':
      return t(opts.long ? 'time.longWeek' : 'time.week', { n: r.n });
    case 'date':
      return formatDay(iso, locale);
  }
}

/** "SW" for "Sarah Weiss", for Hebrew names the first letters. */
export const initials = (name: string | null | undefined): string => {
  const n = (name ?? '').trim();
  return n ? initialsOf(n) : '·';
};
