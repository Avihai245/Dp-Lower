import 'server-only';
import { FIRM_TIMEZONE, computeAvailability, isValidTimeZone, seatsThisWeek, zonedParts, addDays, type SlotDay } from '@dpl/core';
import type { Db } from '@dpl/db/types';
import type { AvailabilityResponse } from '@/components/funnel/logic/api-types';

export interface CallSettings {
  timezone: string;
  callMinutes: number;
  noticeMinutes: number;
  horizonDays: number;
}

const DEFAULTS: CallSettings = { timezone: FIRM_TIMEZONE, callMinutes: 20, noticeMinutes: 120, horizonDays: 5 };
/** How far ahead the booked seats are loaded; `computeAvailability` looks at most this many days forward. */
const LOOKAHEAD_DAYS = 45;
/** Days with free slots always computed, so the seats left in the firm's week are known whatever the listing shows. */
const WEEK_DAYS = 7;

const positiveInt = (v: unknown, fallback: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
};

/** The call settings the CRM can change without a deploy (`app_settings`), with the designed defaults. */
export async function loadCallSettings(db: Db): Promise<CallSettings> {
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['firm_timezone', 'call_minutes', 'booking_notice_minutes', 'booking_horizon_days']);
  const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
  const tz = byKey.get('firm_timezone');
  return {
    timezone: typeof tz === 'string' && isValidTimeZone(tz) ? tz : DEFAULTS.timezone,
    callMinutes: positiveInt(byKey.get('call_minutes'), DEFAULTS.callMinutes, 240),
    noticeMinutes: positiveInt(byKey.get('booking_notice_minutes'), DEFAULTS.noticeMinutes, 60 * 24 * 14),
    horizonDays: positiveInt(byKey.get('booking_horizon_days'), DEFAULTS.horizonDays, 14),
  };
}

/**
 * The next bookable days with their free slots, from the weekly hours (each lawyer's and the unassigned template), the
 * blocked days/slots (a lawyer's own, or closed for everyone), the lawyers who take calls and the seats already taken.
 * Slots are UTC instants; the dates are calendar dates in the firm's zone. A slot is listed while any provider is free.
 * `seatsLeft` is the number of free seats from now to the end of the firm's week, whatever the listing shows: it is the
 * number in "N free calls left this week", which is only shown while it is more than zero.
 */
export async function loadAvailability(db: Db, now: Date = new Date()): Promise<AvailabilityResponse> {
  const settings = await loadCallSettings(db);
  const today = zonedParts(now, settings.timezone).date;
  const until = new Date(now.getTime() + (LOOKAHEAD_DAYS + 1) * 86_400_000).toISOString();

  const [rules, exceptions, booked, lawyers] = await Promise.all([
    db.from('availability_rules').select('weekday, start_time, capacity, active, staff_id'),
    db.from('availability_exceptions').select('on_date, start_time, staff_id').gte('on_date', addDays(today, -1)),
    db
      .from('bookings')
      .select('starts_at, assigned_to')
      .eq('status', 'confirmed')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', until),
    db.from('staff').select('user_id').eq('active', true).eq('role', 'lawyer'),
  ]);
  for (const r of [rules, exceptions, booked, lawyers]) if (r.error) throw new Error(`availability query failed: ${r.error.message}`);

  const upcoming: SlotDay[] = computeAvailability({
    now,
    rules: (rules.data ?? []).map((r) => ({
      weekday: r.weekday,
      startTime: r.start_time,
      capacity: r.capacity,
      active: r.active,
      staffId: r.staff_id,
    })),
    exceptions: (exceptions.data ?? []).map((e) => ({ onDate: e.on_date, startTime: e.start_time, staffId: e.staff_id })),
    bookings: (booked.data ?? []).map((b) => ({ startsAt: b.starts_at, staffId: b.assigned_to })),
    lawyers: (lawyers.data ?? []).map((s) => s.user_id),
    timezone: settings.timezone,
    horizonDays: Math.max(settings.horizonDays, WEEK_DAYS),
    noticeMinutes: settings.noticeMinutes,
    lookaheadDays: LOOKAHEAD_DAYS,
  });

  return {
    days: upcoming.slice(0, settings.horizonDays),
    seatsLeft: seatsThisWeek(upcoming, now, settings.timezone),
    timezone: settings.timezone,
    callMinutes: settings.callMinutes,
  };
}
