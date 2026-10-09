-- Availability per lawyer and the booking transaction that assigns the call. Everything is rolled back.
-- The database is shared with other test runs: this file works on its own staff and leads, on odd times of day
-- (04:20 to 06:40, which neither the template nor another test uses) two days ahead, and asserts only on its own rows.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000d0a1', 'lawyer-a-006@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d0a2', 'lawyer-b-006@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d0a3', 'lawyer-off-006@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d0a4', 'manager-006@example.com', 'authenticated', 'authenticated');
insert into public.staff (user_id, full_name, email, role, active) values
  ('00000000-0000-0000-0000-00000000d0a1', 'Lawyer A', 'lawyer-a-006@example.com', 'lawyer', true),
  ('00000000-0000-0000-0000-00000000d0a2', 'Lawyer B', 'lawyer-b-006@example.com', 'lawyer', true),
  ('00000000-0000-0000-0000-00000000d0a3', 'Lawyer Off', 'lawyer-off-006@example.com', 'lawyer', false),
  ('00000000-0000-0000-0000-00000000d0a4', 'Manager', 'manager-006@example.com', 'case_manager', true);

insert into public.leads (id, full_name, email)
select ('00000000-0000-0000-0000-00000000d00' || n)::uuid, 'Lead ' || n, 'lead-' || n || '-006@example.com'
from generate_series(1, 9) as n;

do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000d0a1';
  b constant uuid := '00000000-0000-0000-0000-00000000d0a2';
  off constant uuid := '00000000-0000-0000-0000-00000000d0a3';
  mgr constant uuid := '00000000-0000-0000-0000-00000000d0a4';
  l1 constant uuid := '00000000-0000-0000-0000-00000000d001';
  l2 constant uuid := '00000000-0000-0000-0000-00000000d002';
  l3 constant uuid := '00000000-0000-0000-0000-00000000d003';
  l4 constant uuid := '00000000-0000-0000-0000-00000000d004';
  l5 constant uuid := '00000000-0000-0000-0000-00000000d005';
  l6 constant uuid := '00000000-0000-0000-0000-00000000d006';
  l7 constant uuid := '00000000-0000-0000-0000-00000000d007';
  l8 constant uuid := '00000000-0000-0000-0000-00000000d008';
  l9 constant uuid := '00000000-0000-0000-0000-00000000d009';
  v_day date := (now() at time zone 'Asia/Jerusalem')::date + 2;
  v_dow int := extract(dow from (now() at time zone 'Asia/Jerusalem')::date + 2)::int;
  v_b public.bookings;
  v_id uuid;
  v_old uuid;
  v_noshow uuid;
  v_msg text;
  v_n int;
  slot timestamptz;
begin
  -- nothing else may offer these times while the test runs (rolled back with everything else)
  delete from public.availability_rules
   where weekday = v_dow and start_time in ('04:20', '04:40', '05:00', '05:20', '05:40', '06:00', '06:20', '06:40');
  delete from public.availability_exceptions where on_date in (v_day, v_day + 7);

  -- one row per scope (a lawyer, or the unassigned template), weekday and time ----------------------------------------
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '04:40', 1);
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (b, v_dow, '04:40', 1);
  begin
    insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '04:40', 1);
    assert false, 'the same lawyer cannot have the same time twice';
  exception when unique_violation then null;
  end;
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (null, v_dow, '04:20', 2);
  begin
    insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (null, v_dow, '04:20', 1);
    assert false, 'the template cannot have the same time twice (nulls not distinct)';
  exception when unique_violation then null;
  end;
  begin
    insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '06:40', 2);
    assert false, 'a lawyer takes one call at a time';
  exception when check_violation then null;
  end;
  insert into public.availability_exceptions (staff_id, on_date) values (null, v_day + 7), (a, v_day + 7);
  begin
    insert into public.availability_exceptions (staff_id, on_date) values (null, v_day + 7);
    assert false, 'a day cannot be closed twice for everyone';
  exception when unique_violation then null;
  end;
  begin
    insert into public.availability_exceptions (staff_id, on_date) values (a, v_day + 7);
    assert false, 'a lawyer cannot block the same day twice';
  exception when unique_violation then null;
  end;
  delete from public.availability_exceptions where on_date = v_day + 7;

  -- no lawyer offers 04:20, the template does: an unassigned seat -----------------------------------------------------
  slot := (v_day + time '04:20') at time zone 'Asia/Jerusalem';
  v_b := public.book_slot(l1, slot, 'Europe/London');
  assert v_b.status = 'confirmed' and v_b.assigned_to is null, 'a template seat is unassigned';
  assert v_b.starts_at = slot and v_b.ends_at = slot + interval '20 minutes', 'times of the template seat';

  -- a lawyer's hours: the call is assigned to them, and never twice at one time -------------------------------------
  delete from public.availability_rules where staff_id = b and start_time = '04:40';
  slot := (v_day + time '04:40') at time zone 'Asia/Jerusalem';
  v_b := public.book_slot(l2, slot, null);
  assert v_b.assigned_to = a, 'the call goes to the lawyer who offers the time';
  begin
    perform public.book_slot(l3, slot, null);
    assert false, 'a lawyer is never booked twice at the same time';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_full', 'expected slot_full, got ' || v_msg;
  end;
  -- the lead asking for its own time again keeps the lawyer: its own call is the one being replaced
  v_b := public.book_slot(l2, slot, null);
  assert v_b.assigned_to = a, 'own call does not block the lawyer';
  assert (select count(*) from public.bookings where lead_id = l2 and status = 'confirmed') = 1, 'one confirmed call per lead';

  -- the partial unique index behind it
  begin
    insert into public.bookings (lead_id, starts_at, ends_at, assigned_to) values (l9, slot, slot + interval '20 minutes', a);
    assert false, 'the index refuses a second confirmed call for one lawyer at one time';
  exception when unique_violation then null;
  end;
  insert into public.bookings (lead_id, starts_at, ends_at, assigned_to, status)
    values (l9, slot, slot + interval '20 minutes', a, 'cancelled');

  -- two lawyers free at 05:00: A already has a call this week, so B gets it, then A, then nobody --------------------
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '05:00', 1), (b, v_dow, '05:00', 1);
  slot := (v_day + time '05:00') at time zone 'Asia/Jerusalem';
  v_b := public.book_slot(l3, slot, null);
  assert v_b.assigned_to = b, 'the lawyer with fewer calls in the coming week gets the call';
  v_b := public.book_slot(l4, slot, null);
  assert v_b.assigned_to = a, 'then the other lawyer';
  begin
    perform public.book_slot(l5, slot, null);
    assert false, 'both lawyers are taken';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_full', 'every provider taken: slot_full, got ' || v_msg;
  end;

  -- equal load: the lowest staff id. A has two calls this week (04:40, 05:00), B one (05:00) plus this one --------------
  insert into public.bookings (lead_id, starts_at, ends_at, assigned_to)
    values (l9, slot + interval '3 hours', slot + interval '3 hours 20 minutes', b);
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '05:20', 1), (b, v_dow, '05:20', 1);
  slot := (v_day + time '05:20') at time zone 'Asia/Jerusalem';
  v_b := public.book_slot(l5, slot, null);
  assert v_b.assigned_to = a, 'equal load: the lowest staff id';
  delete from public.bookings where lead_id = l9 and status = 'confirmed';

  -- a lawyer who is away is not offered; a lawyer's day off closes nothing else ----------------------------------------
  insert into public.availability_exceptions (staff_id, on_date, start_time, reason) values (b, v_day, '05:20', 'away');
  begin
    perform public.book_slot(l6, slot, null);
    assert false, 'A is taken and B is away';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_full', 'A offers the time but is taken: slot_full, got ' || v_msg;
  end;
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (b, v_dow, '05:40', 1);
  insert into public.availability_exceptions (staff_id, on_date, reason) values (b, v_day, 'day off');
  slot := (v_day + time '05:40') at time zone 'Asia/Jerusalem';
  begin
    perform public.book_slot(l6, slot, null);
    assert false, 'the only lawyer of 05:40 is away all day';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'nobody offers it: slot_unavailable, got ' || v_msg;
  end;
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (null, v_dow, '05:40', 1);
  v_b := public.book_slot(l6, slot, null);
  assert v_b.assigned_to is null, 'the template still offers 05:40 while B is away';
  delete from public.availability_exceptions where on_date = v_day and staff_id = b;

  -- closed for everyone: no lawyer and no template seat ------------------------------------------------------------------
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '06:00', 1), (null, v_dow, '06:00', 2);
  insert into public.availability_exceptions (staff_id, on_date, start_time, reason) values (null, v_day, '06:00', 'closed');
  begin
    perform public.book_slot(l7, (v_day + time '06:00') at time zone 'Asia/Jerusalem', null);
    assert false, 'a slot closed for everyone';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'closed for everyone: slot_unavailable, got ' || v_msg;
  end;

  -- only active lawyers are providers; deactivating one keeps their calls -------------------------------------------------
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (off, v_dow, '06:20', 1), (mgr, v_dow, '06:20', 1);
  slot := (v_day + time '06:20') at time zone 'Asia/Jerusalem';
  begin
    perform public.book_slot(l7, slot, null);
    assert false, 'a deactivated lawyer and a case manager offer nothing';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'no active lawyer: slot_unavailable, got ' || v_msg;
  end;
  update public.staff set active = true where user_id = off;
  v_b := public.book_slot(l7, slot, null);
  assert v_b.assigned_to = off, 'once active again the lawyer is offered';
  update public.staff set active = false where user_id = off;
  assert (select status = 'confirmed' and assigned_to = off from public.bookings where id = v_b.id), 'deactivation keeps the call and its lawyer';

  -- lawyers and the template together: a free lawyer first, then the template's seats ---------------------------------
  insert into public.availability_rules (staff_id, weekday, start_time, capacity) values (a, v_dow, '06:40', 1), (null, v_dow, '06:40', 1);
  slot := (v_day + time '06:40') at time zone 'Asia/Jerusalem';
  v_b := public.book_slot(l1, slot, null);
  assert v_b.assigned_to = a, 'a free lawyer before the template';
  v_b := public.book_slot(l8, slot, null);
  assert v_b.assigned_to is null, 'then the template';
  begin
    perform public.book_slot(l9, slot, null);
    assert false, 'lawyer and template are both taken';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_full', 'expected slot_full, got ' || v_msg;
  end;

  -- the notice window and unknown times are unchanged -----------------------------------------------------------------------
  begin
    perform public.book_slot(l9, now() + interval '30 minutes', null);
    assert false, 'too soon';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_too_soon', 'expected slot_too_soon, got ' || v_msg;
  end;
  begin
    perform public.book_slot(l9, (v_day + time '04:47') at time zone 'Asia/Jerusalem', null);
    assert false, 'nobody offers 04:47';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'expected slot_unavailable, got ' || v_msg;
  end;

  -- a call whose time has passed is recorded as held (not cancelled), and the lead can book again ------------------------
  insert into public.bookings (lead_id, starts_at, ends_at, assigned_to)
    values (l9, now() - interval '2 days', now() - interval '2 days' + interval '20 minutes', a)
    returning id into v_id;
  v_b := public.book_slot(l9, (v_day + 7 + time '05:00') at time zone 'Asia/Jerusalem', null);
  assert v_b.status = 'confirmed', 'a lead whose call is over books again';
  assert (select status = 'completed' and cancelled_at is null from public.bookings where id = v_id), 'the passed call is held, not cancelled';
  assert (select count(*) from public.activity_log where lead_id = l9 and code = 'booking_completed' and text = 'Call date passed; marked as held') = 1,
    'one activity line for the held call';
  -- an upcoming call is still cancelled when the lead moves it
  v_id := v_b.id;
  v_b := public.book_slot(l9, (v_day + 7 + time '05:20') at time zone 'Asia/Jerusalem', null);
  assert (select status = 'cancelled' and cancelled_at is not null from public.bookings where id = v_id), 'a moved call is cancelled';

  -- calls nobody marked are recorded as held a day later -------------------------------------------------------------------
  delete from public.bookings where lead_id in (l7, l8);
  insert into public.bookings (lead_id, starts_at, ends_at)
    values (l7, now() - interval '25 hours 20 minutes', now() - interval '25 hours') returning id into v_old;
  insert into public.bookings (lead_id, starts_at, ends_at, status)
    values (l7, now() - interval '3 days', now() - interval '3 days' + interval '20 minutes', 'no_show') returning id into v_noshow;
  insert into public.bookings (lead_id, starts_at, ends_at)
    values (l8, now() - interval '80 minutes', now() - interval '1 hour') returning id into v_id;
  v_n := public.complete_past_bookings(now() - interval '24 hours');
  assert v_n >= 1, 'at least this call was marked';
  assert (select status from public.bookings where id = v_old) = 'completed', 'a call that ended a day ago is held';
  assert (select status from public.bookings where id = v_noshow) = 'no_show', 'a no-show stays a no-show';
  assert (select status from public.bookings where id = v_id) = 'confirmed', 'within a day the call is left for the team to mark';
  assert (select count(*) from public.activity_log where lead_id = l7 and code = 'booking_completed') = 1, 'one line per call';
  perform public.complete_past_bookings(now() - interval '24 hours');
  assert (select count(*) from public.activity_log where lead_id = l7 and code = 'booking_completed') = 1, 'running it again changes nothing';

  -- deleting a lawyer removes their hours and keeps their calls, unassigned ---------------------------------------------------
  select id into v_id from public.bookings where lead_id = l3 and status = 'confirmed';
  assert (select assigned_to from public.bookings where id = v_id) = b, 'B holds a call';
  delete from auth.users where id = b;
  assert (select count(*) from public.availability_rules where staff_id = b) = 0, 'the hours go with the lawyer';
  assert (select status = 'confirmed' and assigned_to is null from public.bookings where id = v_id), 'the call stays booked, unassigned';
end $$;

-- the Data API stays read-only, for the new columns and the new function too ---------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d0a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.availability_rules where staff_id = '00000000-0000-0000-0000-00000000d0a1') > 0, 'a lawyer reads the hours';
  begin
    insert into public.availability_rules (staff_id, weekday, start_time, capacity) values ('00000000-0000-0000-0000-00000000d0a1', 1, '03:43', 1);
    assert false, 'a lawyer cannot write their hours through the Data API';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_past_bookings(now());
    assert false, 'only the server marks calls';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
