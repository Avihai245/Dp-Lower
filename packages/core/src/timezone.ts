/** Time zone helpers without a date library. All "calendar dates" are 'YYYY-MM-DD' strings in the zone given. */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  time: string;
  /** 0 = Sunday */
  weekday: number;
}

export function zonedParts(instant: Date | number, tz: string): ZonedParts {
  const parts = fmt(tz).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') % 24;
  const minute = get('minute');
  const second = get('second');
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    weekday: weekdayOfDate(`${pad(year, 4)}-${pad(month)}-${pad(day)}`),
  };
}

/** Offset of `tz` from UTC at `instant`, in milliseconds (positive east of Greenwich). */
export function tzOffsetMs(instant: Date | number, tz: string): number {
  const t = typeof instant === 'number' ? instant : instant.getTime();
  const p = zonedParts(t, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** The instant at which the wall clock in `tz` reads `date` + `time`. */
export function zonedTimeToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, tz);
  let candidate = guess - off1;
  const off2 = tzOffsetMs(candidate, tz);
  if (off2 !== off1) candidate = guess - off2;
  return new Date(candidate);
}

export function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
