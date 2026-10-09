import { FIRM_TIMEZONE } from './locale';
import { addDays, weekdayOfDate, zonedParts, zonedTimeToUtc } from './timezone';

export interface SlotRule {
  /** 0 = Sunday ... 6 = Saturday, in the firm's zone */
  weekday: number;
  /** 'HH:MM' (or 'HH:MM:SS' from Postgres) in the firm's zone */
  startTime: string;
  capacity: number;
  active?: boolean;
}
export interface SlotException {
  /** 'YYYY-MM-DD' in the firm's zone */
  onDate: string;
  /** null blocks the whole day */
  startTime: string | null;
}
export interface Slot {
  /** ISO instant (UTC) */
  startsAt: string;
  /** 'HH:MM' in the firm's zone (the browser formats startsAt in the visitor's own zone for display) */
  firmTime: string;
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
  /** starts_at (ISO) of every confirmed booking; one entry per seat taken */
  bookedStarts: readonly string[];
  timezone?: string;
  /** how many bookable days to return */
  horizonDays?: number;
  /** minimum notice before a slot can be booked */
  noticeMinutes?: number;
  /** how far ahead to look for those days */
  lookaheadDays?: number;
}

const hhmm = (t: string) => t.slice(0, 5);

/**
 * The next `horizonDays` days that still have at least one free seat, with the free slots of each day.
 * Full slots and slots inside the notice window are left out (the UI never shows a taken slot).
 */
export function computeAvailability(input: AvailabilityInput): SlotDay[] {
  const tz = input.timezone ?? FIRM_TIMEZONE;
  const horizon = input.horizonDays ?? 5;
  const lookahead = input.lookaheadDays ?? 45;
  const earliest = input.now.getTime() + (input.noticeMinutes ?? 120) * 60_000;

  const taken = new Map<string, number>();
  for (const s of input.bookedStarts) {
    const k = new Date(s).toISOString();
    taken.set(k, (taken.get(k) ?? 0) + 1);
  }

  const days: SlotDay[] = [];
  let date = zonedParts(input.now, tz).date;
  for (let i = 0; i < lookahead && days.length < horizon; i++, date = addDays(date, 1)) {
    const weekday = weekdayOfDate(date);
    const dayRules = input.rules.filter((r) => r.active !== false && r.weekday === weekday);
    if (dayRules.length === 0) continue;
    const dayBlocked = input.exceptions.some((e) => e.onDate === date && e.startTime === null);
    if (dayBlocked) continue;

    const slots: Slot[] = [];
    for (const r of [...dayRules].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const time = hhmm(r.startTime);
      if (input.exceptions.some((e) => e.onDate === date && e.startTime !== null && hhmm(e.startTime) === time)) continue;
      const startsAt = zonedTimeToUtc(date, time, tz);
      if (startsAt.getTime() < earliest) continue;
      const remaining = r.capacity - (taken.get(startsAt.toISOString()) ?? 0);
      if (remaining <= 0) continue;
      slots.push({ startsAt: startsAt.toISOString(), firmTime: time, remaining });
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

/** Free seats left in the visitor-facing horizon. Used for the honest "N calls left" line (only shown when low). */
export const seatsLeft = (days: readonly SlotDay[]): number =>
  days.reduce((n, d) => n + d.slots.reduce((m, s) => m + s.remaining, 0), 0);
