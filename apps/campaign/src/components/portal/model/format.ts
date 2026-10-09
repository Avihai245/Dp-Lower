import { FIRM_TIMEZONE, type Locale } from '@dpl/core';

/**
 * Dates in the portal. English uses the day-month order of the prototype ("18 Apr", "12 April 2026"); the call slot
 * keeps the prototype's US wording ("Tue Apr 14"). All of them name their time zone so that the server render and the
 * browser agree (no hydration mismatch) and so that a date never depends on where the visitor happens to be.
 */

const tag = (locale: Locale, us = false): string => (locale === 'he' ? 'he-IL' : us ? 'en-US' : 'en-GB');

function zone(timezone: string | null | undefined): string {
  if (!timezone) return FIRM_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return timezone;
  } catch {
    return FIRM_TIMEZONE;
  }
}

function toDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "18 Apr" */
export function formatShortDate(iso: string, locale: Locale, timezone?: string | null): string {
  const d = toDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short', timeZone: zone(timezone) }).format(d);
}

/** "12 April 2026" */
export function formatLongDate(iso: string, locale: Locale, timezone?: string | null): string {
  const d = toDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: zone(timezone) }).format(d);
}

/** The consultation call: "Tue Apr 14" (English), "יום ג׳, 14 באפר׳" (Hebrew). */
export function formatSlotDate(iso: string, locale: Locale, timezone?: string | null): string {
  const d = toDate(iso);
  if (!d) return '';
  const timeZone = zone(timezone);
  if (locale === 'he') {
    return new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(d);
  }
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('month')} ${get('day')}`;
}

/** 24-hour clock in the viewer's own zone, "14:05" (used for "Sent to ... at 14:05"). */
export function formatClock(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
