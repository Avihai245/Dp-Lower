import 'server-only';
import { FIRM_TIMEZONE, computeAvailability, isValidTimeZone, seatsLeft, zonedParts, addDays, type SlotDay } from '@dpl/core';
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
 * The next bookable days with their free slots, from the weekly template, the blocked days/slots and the seats
 * already taken. Slots are UTC instants; the dates are calendar dates in the firm's zone.
 */
export async function loadAvailability(db: Db, now: Date = new Date()): Promise<AvailabilityResponse> {
  const settings = await loadCallSettings(db);
  const today = zonedParts(now, settings.timezone).date;
  const until = new Date(now.getTime() + (LOOKAHEAD_DAYS + 1) * 86_400_000).toISOString();

  const [rules, exceptions, booked] = await Promise.all([
    db.from('availability_rules').select('weekday, start_time, capacity, active'),
    db.from('availability_exceptions').select('on_date, start_time').gte('on_date', addDays(today, -1)),
    db.from('bookings').select('starts_at').eq('status', 'confirmed').gte('starts_at', now.toISOString()).lte('starts_at', until),
  ]);
  for (const r of [rules, exceptions, booked]) if (r.error) throw new Error(`availability query failed: ${r.error.message}`);

  const days: SlotDay[] = computeAvailability({
    now,
    rules: (rules.data ?? []).map((r) => ({ weekday: r.weekday, startTime: r.start_time, capacity: r.capacity, active: r.active })),
    exceptions: (exceptions.data ?? []).map((e) => ({ onDate: e.on_date, startTime: e.start_time })),
    bookedStarts: (booked.data ?? []).map((b) => b.starts_at),
    timezone: settings.timezone,
    horizonDays: settings.horizonDays,
    noticeMinutes: settings.noticeMinutes,
    lookaheadDays: LOOKAHEAD_DAYS,
  });

  return { days, seatsLeft: seatsLeft(days), timezone: settings.timezone, callMinutes: settings.callMinutes };
}
