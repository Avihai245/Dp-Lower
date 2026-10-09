import 'server-only';
import { FIRM_TIMEZONE, zonedParts } from '@dpl/core';
import type { Db } from '@dpl/db/types';
import type { ActionResult, AvailabilityData, BookingView, ExceptionView, RuleView } from '@/components/admin/types';
import { hhmm } from '@/components/admin/model';
import { done, fail } from './crm-util';

/** Weekly call template, blocked days and the next bookings. Times are 'HH:MM' in the firm's time zone. */
export async function loadAvailability(db: Db): Promise<AvailabilityData> {
  const now = new Date();
  const today = zonedParts(now, FIRM_TIMEZONE).date;
  const [rules, exceptions, bookings, settings] = await Promise.all([
    db.from('availability_rules').select('*').order('weekday').order('start_time'),
    db.from('availability_exceptions').select('*').gte('on_date', today).order('on_date').order('start_time', { nullsFirst: true }),
    db
      .from('bookings')
      .select('id,lead_id,starts_at,ends_at')
      .eq('status', 'confirmed')
      .gte('starts_at', now.toISOString())
      .order('starts_at')
      .limit(40),
    db.from('app_settings').select('key,value').in('key', ['firm_timezone', 'call_minutes']),
  ]);
  for (const r of [rules, exceptions, bookings, settings]) if (r.error) throw new Error(r.error.message);

  const leadIds = [...new Set((bookings.data ?? []).map((b) => b.lead_id))];
  const leads = leadIds.length ? await db.from('leads').select('id,case_ref,full_name,phone').in('id', leadIds) : { data: [] };
  const leadById = new Map((leads.data ?? []).map((l) => [l.id, l]));

  const setting = (key: string) => (settings.data ?? []).find((s) => s.key === key)?.value;
  const rv: RuleView[] = (rules.data ?? []).map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startTime: hhmm(r.start_time),
    capacity: r.capacity,
    active: r.active,
  }));
  const ev: ExceptionView[] = (exceptions.data ?? []).map((e) => ({
    id: e.id,
    onDate: e.on_date,
    startTime: e.start_time ? hhmm(e.start_time) : null,
    reason: e.reason,
  }));
  const bv: BookingView[] = (bookings.data ?? []).map((b) => {
    const l = leadById.get(b.lead_id);
    return {
      id: b.id,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      lead: l ? { id: l.id, caseRef: l.case_ref, name: l.full_name, phone: l.phone } : null,
    };
  });
  return {
    rules: rv,
    exceptions: ev,
    bookings: bv,
    timezone: typeof setting('firm_timezone') === 'string' ? (setting('firm_timezone') as string) : FIRM_TIMEZONE,
    callMinutes: typeof setting('call_minutes') === 'number' ? (setting('call_minutes') as number) : 20,
  };
}

const UNIQUE_VIOLATION = '23505';

export async function addRule(db: Db, a: { weekday: number; startTime: string; capacity: number; active: boolean }): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from('availability_rules')
    .insert({ weekday: a.weekday, start_time: a.startTime, capacity: a.capacity, active: a.active })
    .select('id')
    .single();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'startTime');
  return done({ id: data.id });
}

export async function updateRule(
  db: Db,
  a: { id: string; weekday: number; startTime: string; capacity: number; active: boolean },
): Promise<ActionResult> {
  const { data, error } = await db
    .from('availability_rules')
    .update({ weekday: a.weekday, start_time: a.startTime, capacity: a.capacity, active: a.active })
    .eq('id', a.id)
    .select('id')
    .maybeSingle();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'startTime');
  return data ? done() : fail('not_found');
}

export async function deleteRule(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from('availability_rules').delete().eq('id', id);
  return error ? fail('internal') : done();
}

export async function addException(db: Db, a: { onDate: string; startTime: string | null; reason?: string }): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await db
    .from('availability_exceptions')
    .insert({ on_date: a.onDate, start_time: a.startTime, reason: a.reason?.trim() || null })
    .select('id')
    .single();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'onDate');
  return done({ id: data.id });
}

export async function deleteException(db: Db, id: string): Promise<ActionResult> {
  const { error } = await db.from('availability_exceptions').delete().eq('id', id);
  return error ? fail('internal') : done();
}
