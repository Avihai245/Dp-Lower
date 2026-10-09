import { FIRM_TIMEZONE } from './locale';
import { addDays, weekdayOfDate, zonedParts, zonedTimeToUtc } from './timezone';

/**
 * Who offers a slot. A weekly rule, a blocked day/slot and a booking each belong to a scope:
 *  - a lawyer (`staffId`): that lawyer's own hours, one call at a time, and their own days off;
 *  - nobody (`staffId` null or absent): for a rule, the unassigned (pooled) template with `capacity` calls per slot;
 *    for a blocked day or slot, closed for everyone.
 * A slot is offered while at least one provider is free; `remaining` is the number of free seats over all providers.
 * The database applies the same rules when it books (`book_slot`), and decides there who gets the call.
 */
export interface SlotRule {
  /** 0 = Sunday ... 6 = Saturday, in the firm's zone */
  weekday: number;
  /** 'HH:MM' (or 'HH:MM:SS' from Postgres) in the firm's zone */
  startTime: string;
  /** calls per slot of the unassigned template; a lawyer always takes one call at a time */
  capacity: number;
  active?: boolean;
  /** the lawyer whose hours these are; null or absent: the unassigned template */
  staffId?: string | null;
}
export interface SlotException {
  /** 'YYYY-MM-DD' in the firm's zone */
  onDate: string;
  /** null blocks the whole day */
  startTime: string | null;
  /** the lawyer who is away; null or absent: closed for everyone */
  staffId?: string | null;
}
/** A confirmed booking: one seat of its provider. */
export interface BookedSeat {
  /** ISO instant */
  startsAt: string;
  /** the lawyer the call is assigned to; null: a seat of the unassigned template */
  staffId: string | null;
}
export interface Slot {
  /** ISO instant (UTC) */
  startsAt: string;
  /** 'HH:MM' in the firm's zone (the browser formats startsAt in the visitor's own zone for display) */
  firmTime: string;
  /** free seats over every provider of this time */
  remaining: number;
}
export interface SlotDay {
  /** 'YYYY-MM-DD' in the firm's zone */
  date: string;
  weekday: number;
  slots: Slot[];
}

export interface AvailabilityInput {
  now: Date;
  rules: readonly SlotRule[];
  exceptions: readonly SlotException[];
  /** every confirmed booking from now on (one entry per seat taken) */
  bookings: readonly BookedSeat[];
  /**
   * The lawyers who take calls right now (active staff with the lawyer role). Rules, days off and bookings of anyone
   * else are left out, so a deactivated lawyer is no longer offered. Absent: every lawyer named in `rules`.
   */
  lawyers?: readonly string[];
  timezone?: string;
  /** how many bookable days to return */
  horizonDays?: number;
  /** minimum notice before a slot can be booked */
  noticeMinutes?: number;
  /** how far ahead to look for those days */
  lookaheadDays?: number;
}

const hhmm = (t: string) => t.slice(0, 5);

/** Key of the unassigned template among the providers of a time (a lawyer's key is their staff id). */
const POOLED = '';

/**
 * The next `horizonDays` days that still have at least one free seat, with the free slots of each day.
 * Full slots, blocked ones, slots inside the notice window and wall-clock times that do not exist on a day (the hour
 * the clocks skip in spring) are left out: the UI never shows a slot that cannot be booked.
 */
export function computeAvailability(input: AvailabilityInput): SlotDay[] {
  const tz = input.timezone ?? FIRM_TIMEZONE;
  const horizon = input.horizonDays ?? 5;
  const lookahead = input.lookaheadDays ?? 45;
  const earliest = input.now.getTime() + (input.noticeMinutes ?? 120) * 60_000;
  const lawyers = input.lawyers ? new Set(input.lawyers) : null;
  /** the provider key of a scope, or null when that person takes no calls */
  const provider = (staffId: string | null | undefined): string | null =>
    !staffId ? POOLED : !lawyers || lawyers.has(staffId) ? staffId : null;

  // seats taken, per instant and provider
  const taken = new Map<string, number>();
  const seat = (iso: string, p: string) => `${iso}|${p}`;
  for (const b of input.bookings) {
    const p = provider(b.staffId);
    if (p === null) continue;
    const k = seat(new Date(b.startsAt).toISOString(), p);
    taken.set(k, (taken.get(k) ?? 0) + 1);
  }

  // weekly hours: weekday -> 'HH:MM' -> provider -> seats
  const week = new Map<number, Map<string, Map<string, number>>>();
  for (const r of input.rules) {
    if (r.active === false) continue;
    const p = provider(r.staffId);
    if (p === null) continue;
    const times = week.get(r.weekday) ?? new Map<string, Map<string, number>>();
    week.set(r.weekday, times);
    const time = hhmm(r.startTime);
    const providers = times.get(time) ?? new Map<string, number>();
    times.set(time, providers);
    if (!providers.has(p)) providers.set(p, p === POOLED ? Math.max(0, r.capacity) : 1);
  }

  /** closed for everyone (no staffId), or this provider is away */
  const blocked = (date: string, time: string, p: string): boolean =>
    input.exceptions.some(
      (e) =>
        e.onDate === date &&
        (e.startTime === null || hhmm(e.startTime) === time) &&
        (!e.staffId || e.staffId === p),
    );

  const days: SlotDay[] = [];
  let date = zonedParts(input.now, tz).date;
  for (let i = 0; i < lookahead && days.length < horizon; i++, date = addDays(date, 1)) {
    const weekday = weekdayOfDate(date);
    const times = week.get(weekday);
    if (!times) continue;

    const slots: Slot[] = [];
    for (const time of [...times.keys()].sort()) {
      const startsAt = zonedTimeToUtc(date, time, tz);
      if (startsAt.getTime() < earliest) continue;
      // a time the clocks skip does not exist that day (the database could never match it to the rule)
      const wall = zonedParts(startsAt, tz);
      if (wall.date !== date || wall.time !== time) continue;
      const iso = startsAt.toISOString();
      let remaining = 0;
      for (const [p, seats] of times.get(time)!) {
        if (blocked(date, time, p)) continue;
        remaining += Math.max(0, seats - (taken.get(seat(iso, p)) ?? 0));
      }
      if (remaining > 0) slots.push({ startsAt: iso, firmTime: time, remaining });
    }
    if (slots.length > 0) days.push({ date, weekday, slots });
  }
  return days;
}

/** True when `startsAt` is one of the currently bookable slots (the database re-checks this inside book_slot). */
export function isSlotAvailable(days: readonly SlotDay[], startsAt: string): boolean {
  const iso = new Date(startsAt).toISOString();
  return days.some((d) => d.slots.some((s) => s.startsAt === iso));
}

/** Free seats over the days given. */
export const seatsLeft = (days: readonly SlotDay[]): number =>
  days.reduce((n, d) => n + d.slots.reduce((m, s) => m + s.remaining, 0), 0);

/** The Saturday that ends the firm's week (a week starts on Sunday) in which the calendar date `date` falls. */
export const endOfFirmWeek = (date: string): string => addDays(date, 6 - weekdayOfDate(date));

/**
 * Free seats from now to the end of the firm's current week: the number behind "N free calls left this week", so that
 * the words are true. `days` must reach the end of that week (a horizon of seven days with slots always does); a day
 * after it does not count, so on a Thursday evening after the last call the number is 0 and the line is not shown.
 */
export function seatsThisWeek(days: readonly SlotDay[], now: Date, timezone: string = FIRM_TIMEZONE): number {
  const last = endOfFirmWeek(zonedParts(now, timezone).date);
  return seatsLeft(days.filter((d) => d.date <= last));
}
