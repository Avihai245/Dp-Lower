-- Signed-in users, staff included, cannot write through the Data API: the server (service role) does that.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner-ro@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'admin-ro@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'manager-ro@example.com', 'authenticated', 'authenticated');
insert into public.staff (user_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000c3', 'Admin', 'admin-ro@example.com', 'admin'),
  ('00000000-0000-0000-0000-0000000000c4', 'Manager', 'manager-ro@example.com', 'case_manager');
insert into public.leads (id, full_name, email, user_id) values
  ('00000000-0000-0000-0000-00000000c001', 'Owner', 'owner-ro@example.com', '00000000-0000-0000-0000-0000000000c1');
insert into public.availability_rules (weekday, start_time, capacity) values (0, '03:41', 1);

-- every write statement below must be refused with insufficient_privilege, for each signed-in role
create temp table write_attempts (label text, stmt text);
grant all on write_attempts to authenticated;
insert into write_attempts values
  ('update leads', $$update public.leads set status = 'under_review', user_id = null$$),
  ('delete leads', $$delete from public.leads$$),
  ('insert leads', $$insert into public.leads (full_name, email) values ('x', 'x-ro@example.com')$$),
  ('update documents', $$update public.documents set status = 'received'$$),
  ('update applications', $$update public.applications set data = '{}'$$),
  ('update bookings', $$update public.bookings set status = 'cancelled'$$),
  ('insert lead_notes', $$insert into public.lead_notes (lead_id, body) values ('00000000-0000-0000-0000-00000000c001', 'x')$$),
  ('delete lead_notes', $$delete from public.lead_notes$$),
  ('insert activity_log', $$insert into public.activity_log (lead_id, kind, code, text) values ('00000000-0000-0000-0000-00000000c001', 'system', 'forged', 'forged')$$),
  ('delete availability_rules', $$delete from public.availability_rules$$),
  ('insert availability_rules', $$insert into public.availability_rules (weekday, start_time, capacity) values (1, '03:41', 1)$$),
  ('update availability_exceptions', $$update public.availability_exceptions set reason = 'x'$$),
  ('update staff', $$update public.staff set role = 'admin'$$),
  ('insert staff', $$insert into public.staff (user_id, full_name, email, role) values ('00000000-0000-0000-0000-0000000000c1', 'x', 'x-ro@example.com', 'admin')$$),
  ('update app_settings', $$update public.app_settings set value = '1'::jsonb$$),
  ('update callback_requests', $$update public.callback_requests set status = 'closed'$$),
  ('update contact_submissions', $$update public.contact_submissions set status = 'closed'$$),
  ('insert events', $$insert into public.events (type, payload) values ('x', '{}')$$),
  ('update events', $$update public.events set status = 'sent'$$),
  ('truncate leads', $$truncate public.leads$$);

do $$
declare
  who text;
  attempt record;
begin
  foreach who in array array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
    set local role authenticated;
    for attempt in select label, stmt from write_attempts loop
      begin
        execute attempt.stmt;
        raise exception 'user % could write: %', who, attempt.label;
      exception when insufficient_privilege then null;
      end;
    end loop;
    reset role;
  end loop;
end $$;

-- ...and the reads that the CRM and Realtime need are still there
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.leads where id = '00000000-0000-0000-0000-00000000c001') = 1, 'staff still reads leads';
  assert (select count(*) from public.availability_rules where start_time = '03:41') = 1, 'staff still reads the availability template';
  assert (select count(*) from public.admin_lead_rows where full_name = 'Owner') = 1, 'staff still reads the CRM rows';
end $$;
reset role;

rollback;
