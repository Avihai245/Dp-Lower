import { addDays, zonedParts, zonedTimeToUtc, type BookingInput } from '@dpl/core';
import { createAdminSupabase } from '@dpl/db/admin';
import { ApiError } from '@dpl/db/http';
import type { BookingRow, Db, LeadRow } from '@dpl/db/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanupLeads, loadLocalEnv, makeLead } from './test-env';

vi.mock('server-only', () => ({}));

const hasDb = loadLocalEnv();
const TZ = 'Asia/Jerusalem';
const HOUR = 3_600_000;

/**
 * Booking with lawyers against the local Supabase: who gets the call, what the outbox and the emails carry, the
 * funnel's cancel, a call whose time has passed, the dispatcher's clean-up and the team's buttons.
 * The database is shared: the two lawyers, their hours and the leads are this run's own, the hours sit at odd times
 * on a weekday 16 days ahead, and the lawyers are away on the two earlier dates of that weekday, so the visitor-facing
 * calendar never offers them while the test runs. Everything is removed afterwards.
 */
describe.skipIf(!hasDb)('booking with lawyers (local Supabase)', () => {
  let db: Db;
  let bookings: typeof import('./bookings');
  let crm: typeof import('./crm-bookings');
  const run = Date.now().toString(36);
  const leads: string[] = [];
  const users: string[] = [];
  const lawyer = { a: { id: '', name: `Anna Lawyer ${run}` }, b: { id: '', name: `Ben Lawyer ${run}` } };
  const day = addDays(zonedParts(new Date(), TZ).date, 16);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const at = (time: string, date = day) => zonedTimeToUtc(date, time, TZ).toISOString();
  const SLOT = '05:10';
  const LATER = '05:50';

  const lead = async (name = 'Test Lead'): Promise<LeadRow> => {
    const l = await makeLead(db, { createdAt: new Date(), name });
    leads.push(l.id);
    return l;
  };
  const staffUser = async (key: 'a' | 'b'): Promise<string> => {
    const email = `bookings-test-${key}-${run}@example.com`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: `Pw-${run}-${key}-long`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    users.push(data.user.id);
    const { error: e2 } = await db
      .from('staff')
      .insert({ user_id: data.user.id, full_name: lawyer[key].name, email, role: 'lawyer' });
    if (e2) throw new Error(e2.message);
    return data.user.id;
  };
  const input = (time: string): BookingInput => ({ startsAt: at(time), timezone: 'Europe/London' });
  const book = (l: LeadRow, time: string) => bookings.bookCall(db, l, input(time));
  const row = async (id: string): Promise<BookingRow> =>
    (await db.from('bookings').select('*').eq('id', id).single()).data!;
  const event = async (key: string) =>
    (await db.from('events').select('*').eq('dedupe_key', key).maybeSingle()).data;
  const codes = async (leadId: string) =>
    ((await db.from('activity_log').select('code').eq('lead_id', leadId)).data ?? []).map((r) => r.code);
  /** a confirmed call inserted directly, `startsIn` ms from now */
  const insertCall = async (l: LeadRow, startsIn: number, assignedTo: string | null = null) => {
    const starts = new Date(Date.now() + startsIn);
    const { data, error } = await db
      .from('bookings')
      .insert({
        lead_id: l.id,
        starts_at: starts.toISOString(),
        ends_at: new Date(starts.getTime() + 20 * 60_000).toISOString(),
        assigned_to: assignedTo,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  };

  beforeAll(async () => {
    db = createAdminSupabase();
    bookings = await import('./bookings');
    crm = await import('./crm-bookings');
    lawyer.a.id = await staffUser('a');
    lawyer.b.id = await staffUser('b');
    // away first (so the hours are never offered on the earlier dates), then the hours
    const away = [addDays(day, -14), addDays(day, -7)].flatMap((onDate) =>
      [lawyer.a.id, lawyer.b.id].map((staff_id) => ({
        staff_id,
        on_date: onDate,
        reason: `bookings-test ${run}`,
      })),
    );
    expect((await db.from('availability_exceptions').insert(away)).error).toBeNull();
    const rules = [SLOT, LATER].flatMap((start_time) =>
      [lawyer.a.id, lawyer.b.id].map((staff_id) => ({ staff_id, weekday, start_time, capacity: 1 })),
    );
    expect((await db.from('availability_rules').insert(rules)).error).toBeNull();
  });

  afterAll(async () => {
    if (!db) return;
    // the hours first, so nothing of this run is ever offered once the calls are gone
    for (const id of users) await db.from('availability_rules').delete().eq('staff_id', id);
    await cleanupLeads(db, leads);
    for (const id of users) await db.auth.admin.deleteUser(id);
  });

  it('assigns the call to the free lawyer with fewer calls this week, names them in the outbox and the email', async () => {
    // Anna already has a call in the coming week
    await insertCall(await lead('Busy Week'), 26 * HOUR, lawyer.a.id);
    const l = await lead('rachel hoffman');
    const { booking, created } = await book(l, SLOT);
    expect(created).toBe(true);
    expect(booking.assigned_to).toBe(lawyer.b.id);

    const ev = await event(`booking.created:${booking.id}`);
    expect(ev?.payload).toMatchObject({
      lead: { id: l.id },
      booking: {
        id: booking.id,
        minutes: 20,
        lawyer: { id: lawyer.b.id, name: lawyer.b.name, email: `bookings-test-b-${run}@example.com` },
      },
    });
    const mail = (await event(`booking-confirmation:${booking.id}`))?.payload as {
      html: string;
      text: string;
    };
    expect(mail.html).toContain(`Your call is with ${lawyer.b.name}.`);
    // "Change or cancel" opens the lead's own booking step through a signed link
    const href = /<a href="([^"]+)"[^>]*>Change or cancel<\/a>/.exec(mail.html)?.[1];
    expect(href).toMatch(/\/go\/[\w-]+\.[\w-]+$/);
    const token = href!.split('/go/')[1]!;
    expect(JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString())).toMatchObject({
      lid: l.id,
      p: 'portal',
      n: '/booking',
    });
    const log = (
      await db.from('activity_log').select('text').eq('lead_id', l.id).eq('code', 'booking_created').single()
    ).data;
    expect(log?.text).toContain(`with ${lawyer.b.name}`);
  });

  it('gives the next caller the other lawyer, then reports the time as taken', async () => {
    const second = await book(await lead('Second'), SLOT);
    expect(second.booking.assigned_to).toBe(lawyer.a.id);
    const third = await lead('Third');
    await expect(book(third, SLOT)).rejects.toMatchObject({
      status: 409,
      code: 'slot_unavailable',
      details: { reason: 'slot_full' },
    });
    expect(await bookings.activeBooking(db, third.id)).toBeNull();
  });

  it('cancelling from the funnel frees the lawyer, emails the applicant a link to book again and tells the CRM', async () => {
    const l = await lead('Cancel Me');
    // Ben and Anna are both taken at SLOT: use the later time
    const { booking } = await book(l, LATER);
    const cancelled = await bookings.cancelBooking(db, l);
    expect(cancelled.id).toBe(booking.id);
    expect(await row(booking.id)).toMatchObject({ status: 'cancelled' });
    expect((await event(`booking.cancelled:${booking.id}`))?.payload).toMatchObject({ reason: 'cancelled' });
    const mail = (await event(`booking-cancelled:${booking.id}`))?.payload as {
      html: string;
      template: string;
    };
    expect(mail.template).toBe('booking-cancelled');
    expect(mail.html).toMatch(/<a href="[^"]+\/go\/[\w.-]+"[^>]*>Book my free call<\/a>/);
    expect(await codes(l.id)).toContain('booking_cancelled');
    // nothing left to cancel
    await expect(bookings.cancelBooking(db, l)).rejects.toBeInstanceOf(ApiError);
    // ...and the lawyer is free again
    const again = await book(await lead('Takes It'), LATER);
    expect([lawyer.a.id, lawyer.b.id]).toContain(again.booking.assigned_to);
  });

  it('a call whose time has passed is not upcoming, cannot be cancelled, and is recorded as held when the lead books again', async () => {
    const l = await lead('Had A Call');
    const past = await insertCall(l, -2 * HOUR);
    expect(await bookings.activeBooking(db, l.id)).toBeNull();
    await expect(bookings.cancelBooking(db, l)).rejects.toMatchObject({ status: 404 });
    const { booking } = await bookings.bookCall(db, l, {
      startsAt: at('05:10', addDays(day, 7)),
      timezone: 'Asia/Jerusalem',
    });
    expect(booking.status).toBe('confirmed');
    expect(await row(past.id)).toMatchObject({ status: 'completed', cancelled_at: null });
    expect(await event(`booking.cancelled:${past.id}`)).toBeNull();
    expect(await event(`booking-cancelled:${past.id}`)).toBeNull();
    expect(await codes(l.id)).toContain('booking_completed');
  });

  it('the dispatcher records calls nobody marked a day later, once', async () => {
    const old = await lead('Old Call');
    const recent = await lead('Recent Call');
    const a = await insertCall(old, -25 * HOUR - 20 * 60_000);
    const b = await insertCall(recent, -2 * HOUR);
    expect(await bookings.completePastBookings(db)).toBeGreaterThanOrEqual(1);
    expect((await row(a.id)).status).toBe('completed');
    expect((await row(b.id)).status).toBe('confirmed');
    const lines = async () =>
      (await db.from('activity_log').select('text').eq('lead_id', old.id).eq('code', 'booking_completed'))
        .data ?? [];
    expect(await lines()).toEqual([{ text: 'Call date passed; marked as held' }]);
    await bookings.completePastBookings(db);
    expect(await lines()).toHaveLength(1);
  });

  it('the team marks a call held or a no-show (each corrects the other) and cancels an upcoming one', async () => {
    const actor = { id: lawyer.a.id, name: lawyer.a.name };
    const l = await lead('Staff Buttons');
    const past = await insertCall(l, -3 * HOUR, lawyer.b.id);

    expect(await crm.callAction(db, actor, { leadId: l.id, bookingId: past.id, action: 'no_show' })).toEqual({
      ok: true,
      data: { status: 'no_show' },
    });
    const noShow = await event(`booking.no_show:${past.id}`);
    expect(noShow).toMatchObject({ type: 'booking.no_show', channel: 'crm', lead_id: l.id });
    expect(noShow?.payload).toMatchObject({
      booking: { id: past.id, lawyer: { id: lawyer.b.id } },
      by: lawyer.a.name,
    });
    // no email to the applicant for a no-show
    expect(
      ((await db.from('events').select('id').eq('lead_id', l.id).eq('channel', 'email')).data ?? []).length,
    ).toBe(0);

    expect(await crm.callAction(db, actor, { leadId: l.id, bookingId: past.id, action: 'held' })).toEqual({
      ok: true,
      data: { status: 'completed' },
    });
    expect(await crm.callAction(db, actor, { leadId: l.id, bookingId: past.id, action: 'no_show' })).toEqual({
      ok: true,
      data: { status: 'no_show' },
    });
    // the first no-show has the fixed key; the correction to held and the second no-show are new facts for the CRM
    expect(
      ((await db.from('events').select('id').eq('dedupe_key', `booking.no_show:${past.id}`)).data ?? [])
        .length,
    ).toBe(1);
    const sequence = ((await db.from('events').select('type, created_at').eq('lead_id', l.id).in('type', ['booking.no_show', 'booking.held'])).data ?? [])
      .sort((x, y) => x.created_at.localeCompare(y.created_at))
      .map((r) => r.type);
    expect(sequence).toEqual(['booking.no_show', 'booking.held', 'booking.no_show']);
    const staffCodes =
      (await db.from('activity_log').select('code, kind, actor_name').eq('lead_id', l.id).eq('kind', 'staff'))
        .data ?? [];
    expect(staffCodes.map((r) => r.code).sort()).toEqual([
      'booking_held',
      'booking_no_show',
      'booking_no_show',
    ]);
    expect(staffCodes.every((r) => r.actor_name === lawyer.a.name)).toBe(true);
    // a past call cannot be cancelled
    expect(
      await crm.callAction(db, actor, { leadId: l.id, bookingId: past.id, action: 'cancel' }),
    ).toMatchObject({ ok: false, error: 'conflict' });

    const next = await lead('Staff Cancel');
    const { booking } = await bookings.bookCall(db, next, {
      startsAt: at('05:50', addDays(day, 7)),
      timezone: 'Europe/London',
    });
    // not started yet: it cannot be marked
    expect(
      await crm.callAction(db, actor, { leadId: next.id, bookingId: booking.id, action: 'held' }),
    ).toMatchObject({ ok: false, error: 'conflict' });
    expect(
      await crm.callAction(db, actor, { leadId: next.id, bookingId: booking.id, action: 'cancel' }),
    ).toEqual({ ok: true, data: { status: 'cancelled' } });
    expect((await event(`booking.cancelled:${booking.id}`))?.payload).toMatchObject({
      reason: 'staff',
      by: lawyer.a.name,
    });
    expect(((await event(`booking-cancelled:${booking.id}`))?.payload as { template: string }).template).toBe(
      'booking-cancelled',
    );
    const line = (
      await db
        .from('activity_log')
        .select('kind, actor_name')
        .eq('lead_id', next.id)
        .eq('code', 'booking_cancelled')
        .single()
    ).data;
    expect(line).toEqual({ kind: 'staff', actor_name: lawyer.a.name });
    // a booking of another lead is not found through this lead
    expect(
      await crm.callAction(db, actor, { leadId: l.id, bookingId: booking.id, action: 'cancel' }),
    ).toMatchObject({ ok: false, error: 'not_found' });
  });
});
