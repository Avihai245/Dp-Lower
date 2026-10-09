-- Defaults, case references, and the booking transaction. Everything is rolled back.
begin;

do $$
declare
  v_lead1 uuid; v_lead2 uuid; v_lead3 uuid; v_lead4 uuid;
  v_slot timestamptz;
  v_b public.bookings;
  v_msg text;
  v_ref1 text; v_ref2 text;
begin
  -- defaults -----------------------------------------------------------------
  -- the seeded template (lawyers' own hours, staff_id set, are not part of it)
  assert (select count(*) from public.availability_rules where staff_id is null) = 30, 'expected 5 days x 6 slots seeded';
  assert public.setting_text('firm_timezone', 'x') = 'Asia/Jerusalem', 'firm timezone setting';
  assert public.setting_text('call_minutes', 'x') = '20', 'call minutes setting';

  -- leads, case references, lowercase email check -----------------------------
  insert into public.leads (full_name, email) values ('A One', 'a1@example.com') returning id, case_ref into v_lead1, v_ref1;
  insert into public.leads (full_name, email) values ('B Two', 'b2@example.com') returning id, case_ref into v_lead2, v_ref2;
  insert into public.leads (full_name, email) values ('C Three', 'c3@example.com') returning id into v_lead3;
  insert into public.leads (full_name, email) values ('D Four', 'd4@example.com') returning id into v_lead4;
  assert v_ref1 ~ '^DPL-[0-9]{2}-[0-9]{4}$', 'case_ref format: ' || v_ref1;
  assert v_ref1 <> v_ref2, 'case_ref unique';

  begin
    insert into public.leads (full_name, email) values ('Dup', 'A1@EXAMPLE.COM');
    assert false, 'uppercase email must be rejected';
  exception when check_violation then null;
  end;
  begin
    insert into public.leads (full_name, email) values ('Dup', 'a1@example.com');
    assert false, 'duplicate email must be rejected';
  exception when unique_violation then null;
  end;

  -- stage_since follows stage --------------------------------------------------
  update public.leads set stage_since = now() - interval '3 days' where id = v_lead1;
  update public.leads set stage = 'account' where id = v_lead1;
  assert (select stage_since from public.leads where id = v_lead1) > now() - interval '1 minute', 'stage_since reset on stage change';

  -- booking --------------------------------------------------------------------
  select (((current_date + g.i) + time '10:30') at time zone 'Asia/Jerusalem') into v_slot
  from generate_series(2, 14) as g(i)
  where extract(dow from current_date + g.i) between 0 and 4
  order by g.i limit 1;

  v_b := public.book_slot(v_lead1, v_slot, 'America/New_York');
  assert v_b.status = 'confirmed' and v_b.starts_at = v_slot, 'booking confirmed';
  assert v_b.ends_at = v_slot + interval '20 minutes', 'call length';

  v_b := public.book_slot(v_lead2, v_slot, 'Europe/London');   -- second seat in the slot
  assert v_b.status = 'confirmed', 'second booking in same slot';

  begin
    perform public.book_slot(v_lead3, v_slot, null);            -- capacity is 2
    assert false, 'third booking must fail';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_full', 'expected slot_full, got ' || v_msg;
  end;

  begin
    perform public.book_slot(v_lead3, v_slot + interval '7 minutes', null);   -- not on the template
    assert false, 'off-template slot must fail';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'expected slot_unavailable, got ' || v_msg;
  end;

  begin
    perform public.book_slot(v_lead3, now() - interval '1 day', null);
    assert false, 'past slot must fail';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_too_soon', 'expected slot_too_soon, got ' || v_msg;
  end;

  -- a blocked day is unavailable ---------------------------------------------------
  insert into public.availability_exceptions (on_date, reason) values ((v_slot at time zone 'Asia/Jerusalem')::date, 'holiday');
  begin
    perform public.book_slot(v_lead4, v_slot, null);
    assert false, 'blocked day must fail';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'slot_unavailable', 'expected slot_unavailable on blocked day, got ' || v_msg;
  end;
  delete from public.availability_exceptions;

  -- rescheduling replaces the previous booking --------------------------------------
  v_b := public.book_slot(v_lead1, v_slot + interval '1 day', null);
  assert (select count(*) from public.bookings where lead_id = v_lead1 and status = 'confirmed') = 1, 'one active booking per lead';
  assert (select count(*) from public.bookings where lead_id = v_lead1 and status = 'cancelled') = 1, 'previous booking cancelled';
  -- ...which frees the seat in the original slot
  v_b := public.book_slot(v_lead3, v_slot, null);
  assert v_b.status = 'confirmed', 'freed seat can be booked';
end $$;

rollback;
