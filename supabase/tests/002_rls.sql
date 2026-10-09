-- Row level security as seen by an applicant, a stranger, staff and anon.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'stranger@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'staff@example.com', 'authenticated', 'authenticated');
insert into public.staff (user_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a3', 'Staff Member', 'staff@example.com', 'admin');

insert into public.leads (id, full_name, email, user_id) values
  ('00000000-0000-0000-0000-00000000f001', 'Owner', 'owner@example.com', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f002', 'Other', 'other@example.com', null);
insert into public.documents (lead_id, doc_type, status) values ('00000000-0000-0000-0000-00000000f001', 'passport', 'received');
insert into public.lead_notes (lead_id, body) values ('00000000-0000-0000-0000-00000000f001', 'internal only');
insert into public.callback_requests (phone) values ('+972500000000');
insert into public.events (type, payload) values ('lead.created', '{}');

-- the applicant ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.leads) = 1, 'owner sees exactly their lead';
  assert (select count(*) from public.documents) = 1, 'owner sees their documents';
  assert (select count(*) from public.lead_notes) = 0, 'owner never sees internal notes';
  assert (select count(*) from public.callback_requests) = 0, 'owner cannot read callbacks';
  assert (select count(*) from public.events) = 0, 'owner cannot read the outbox';
  assert not public.is_staff(), 'owner is not staff';
  update public.leads set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000f001';
  assert (select full_name from public.leads) = 'Owner', 'owner cannot update their lead directly';
  begin
    insert into public.leads (full_name, email) values ('X', 'x@example.com');
    assert false, 'owner cannot insert leads';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- a stranger -----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.leads) = 0, 'stranger sees no leads';
  assert (select count(*) from public.documents) = 0, 'stranger sees no documents';
  assert (select count(*) from public.admin_lead_rows) = 0, 'stranger sees no CRM rows';
end $$;
reset role;

-- staff --------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert public.is_staff() and public.is_admin(), 'staff recognised';
  assert (select count(*) from public.leads) = 2, 'staff sees all leads';
  assert (select count(*) from public.lead_notes) = 1, 'staff sees notes';
  assert (select count(*) from public.callback_requests) = 1, 'staff sees callbacks';
  assert (select count(*) from public.events) = 1, 'staff sees the outbox';
  assert (select docs_received from public.admin_lead_rows where full_name = 'Owner') = 1, 'CRM row counts documents';
  assert (select notes_count from public.admin_lead_rows where full_name = 'Owner') = 1, 'CRM row counts notes';
  update public.leads set status = 'under_review' where id = '00000000-0000-0000-0000-00000000f001';
  assert (select status from public.leads where id = '00000000-0000-0000-0000-00000000f001') = 'under_review', 'staff can update';
end $$;
reset role;

-- anonymous --------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform count(*) from public.leads;
    assert false, 'anon must not read leads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.book_slot('00000000-0000-0000-0000-00000000f001', now() + interval '1 day', null);
    assert false, 'anon must not call book_slot';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
