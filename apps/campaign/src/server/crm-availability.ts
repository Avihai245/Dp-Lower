import 'server-only';
import { FIRM_TIMEZONE, zonedParts } from '@dpl/core';
import type { Db } from '@dpl/db/types';
import type { ActionResult, AvailabilityData, BookingView, ExceptionView, LawyerView, RuleView } from '@/components/admin/types';
import { hhmm } from '@/components/admin/model';
import { canEditScope, type CalendarScope } from '@/components/admin/scopes';
import { done, fail } from './crm-util';
import type { StaffSession } from './staff';

/**
 * The availability page: each lawyer's weekly hours and days off, the unassigned template, the days closed for
 * everyone, and the next calls with the lawyer each one is assigned to. Times are 'HH:MM' in the firm's time zone.
 */
export async function loadAvailability(db: Db): Promise<AvailabilityData> {
  const now = new Date();
  const today = zonedParts(now, FIRM_TIMEZONE).date;
  const [rules, exceptions, bookings, settings, lawyers] = await Promise.all([
    db.from('availability_rules').select('*').order('weekday').order('start_time'),
    db.from('availability_exceptions').select('*').gte('on_date', today).order('on_date').order('start_time', { nullsFirst: true }),
    db
      .from('bookings')
      .select('id,lead_id,starts_at,ends_at,lawyer:staff!bookings_assigned_to_fkey(user_id,full_name)')
      .eq('status', 'confirmed')
      .gt('ends_at', now.toISOString())
      .order('starts_at')
      .limit(40),
    db.from('app_settings').select('key,value').in('key', ['firm_timezone', 'call_minutes']),
    db.from('staff').select('user_id,full_name').eq('active', true).eq('role', 'lawyer').order('full_name'),
  ]);
  for (const r of [rules, exceptions, bookings, settings, lawyers]) if (r.error) throw new Error(r.error.message);

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
    staffId: r.staff_id,
  }));
  const ev: ExceptionView[] = (exceptions.data ?? []).map((e) => ({
    id: e.id,
    onDate: e.on_date,
    startTime: e.start_time ? hhmm(e.start_time) : null,
    reason: e.reason,
    staffId: e.staff_id,
  }));
  const bv: BookingView[] = (bookings.data ?? []).map((b) => {
    const l = leadById.get(b.lead_id);
    return {
      id: b.id,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      lead: l ? { id: l.id, caseRef: l.case_ref, name: l.full_name, phone: l.phone } : null,
      lawyer: b.lawyer ? { id: b.lawyer.user_id, name: b.lawyer.full_name } : null,
    };
  });
  const lv: LawyerView[] = (lawyers.data ?? []).map((s) => ({ id: s.user_id, name: s.full_name }));
  return {
    rules: rv,
    exceptions: ev,
    bookings: bv,
    lawyers: lv,
    timezone: typeof setting('firm_timezone') === 'string' ? (setting('firm_timezone') as string) : FIRM_TIMEZONE,
    callMinutes: typeof setting('call_minutes') === 'number' ? (setting('call_minutes') as number) : 20,
  };
}

const UNIQUE_VIOLATION = '23505';

type Session = Pick<StaffSession, 'staff'>;
const editor = (s: Session) => ({ id: s.staff.user_id, role: s.staff.role });

/**
 * May the caller change this calendar? A lawyer's calendar must also belong to someone who takes calls (an active
 * lawyer): hours for anyone else would never be offered. Returns the failure, or null when the change may go ahead.
 */
async function guardScope(db: Db, s: Session, scope: CalendarScope, opts: { creating: boolean }): Promise<ReturnType<typeof fail> | null> {
  if (!canEditScope(editor(s), scope)) return fail('forbidden');
  if (scope !== null && opts.creating) {
    const { data } = await db.from('staff').select('role,active').eq('user_id', scope).maybeSingle();
    if (!data || !data.active || data.role !== 'lawyer') return fail('invalid', 'staffId');
  }
  return null;
}

/** The calendar a stored row belongs to (read on the server: the browser never says whose row it is). */
async function scopeOf(db: Db, table: 'availability_rules' | 'availability_exceptions', id: string): Promise<{ scope: CalendarScope } | null> {
  const { data } = await db.from(table).select('staff_id').eq('id', id).maybeSingle();
  return data ? { scope: data.staff_id } : null;
}

export async function addRule(
  db: Db,
  s: Session,
  a: { weekday: number; startTime: string; capacity: number; active: boolean; staffId?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const scope = a.staffId ?? null;
  const refused = await guardScope(db, s, scope, { creating: true });
  if (refused) return refused;
  const { data, error } = await db
    .from('availability_rules')
    // a lawyer takes one call at a time
    .insert({ staff_id: scope, weekday: a.weekday, start_time: a.startTime, capacity: scope ? 1 : a.capacity, active: a.active })
    .select('id')
    .single();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'startTime');
  return done({ id: data.id });
}

export async function updateRule(
  db: Db,
  s: Session,
  a: { id: string; weekday: number; startTime: string; capacity: number; active: boolean },
): Promise<ActionResult> {
  const row = await scopeOf(db, 'availability_rules', a.id);
  if (!row) return fail('not_found');
  const refused = await guardScope(db, s, row.scope, { creating: false });
  if (refused) return refused;
  const { data, error } = await db
    .from('availability_rules')
    .update({ weekday: a.weekday, start_time: a.startTime, capacity: row.scope ? 1 : a.capacity, active: a.active })
    .eq('id', a.id)
    .select('id')
    .maybeSingle();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'startTime');
  return data ? done() : fail('not_found');
}

export async function deleteRule(db: Db, s: Session, id: string): Promise<ActionResult> {
  const row = await scopeOf(db, 'availability_rules', id);
  if (!row) return done();
  const refused = await guardScope(db, s, row.scope, { creating: false });
  if (refused) return refused;
  const { error } = await db.from('availability_rules').delete().eq('id', id);
  return error ? fail('internal') : done();
}

export async function addException(
  db: Db,
  s: Session,
  a: { onDate: string; startTime: string | null; reason?: string; staffId?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const scope = a.staffId ?? null;
  const refused = await guardScope(db, s, scope, { creating: true });
  if (refused) return refused;
  const { data, error } = await db
    .from('availability_exceptions')
    .insert({ staff_id: scope, on_date: a.onDate, start_time: a.startTime, reason: a.reason?.trim() || null })
    .select('id')
    .single();
  if (error) return fail(error.code === UNIQUE_VIOLATION ? 'duplicate' : 'internal', 'onDate');
  return done({ id: data.id });
}

export async function deleteException(db: Db, s: Session, id: string): Promise<ActionResult> {
  const row = await scopeOf(db, 'availability_exceptions', id);
  if (!row) return done();
  const refused = await guardScope(db, s, row.scope, { creating: false });
  if (refused) return refused;
  const { error } = await db.from('availability_exceptions').delete().eq('id', id);
  return error ? fail('internal') : done();
}
