-- Staff who enrolled an authenticator app are staff to the database only after the second step (assurance level aal2).
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'mfa-admin@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'mfa-manager@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'mfa-plain@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f4', 'mfa-pending@example.com', 'authenticated', 'authenticated');
insert into public.staff (user_id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'Enrolled admin', 'mfa-admin@example.com', 'admin'),
  ('00000000-0000-0000-0000-0000000000f2', 'Enrolled manager', 'mfa-manager@example.com', 'case_manager'),
  ('00000000-0000-0000-0000-0000000000f3', 'Not enrolled', 'mfa-plain@example.com', 'admin'),
  ('00000000-0000-0000-0000-0000000000f4', 'Half enrolled', 'mfa-pending@example.com', 'admin');
insert into public.leads (id, full_name, email) values
  ('00000000-0000-0000-0000-00000000f001', 'Someone', 'someone-mfa@example.com');

-- f1 and f2 finished enrolling; f4 started but never confirmed the first code (an unverified factor protects nothing)
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-0000000000f1', 'phone', 'totp', 'verified', now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-0000000000f2', 'phone', 'totp', 'verified', now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000fa04', '00000000-0000-0000-0000-0000000000f4', 'phone', 'totp', 'unverified', now(), now(), 'x');

create temp table seen (who text, aal text, staff boolean, admin boolean, leads bigint);
grant all on seen to authenticated;

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('00000000-0000-0000-0000-0000000000f1', 'aal1'), ('00000000-0000-0000-0000-0000000000f1', 'aal2'),
      ('00000000-0000-0000-0000-0000000000f2', 'aal1'), ('00000000-0000-0000-0000-0000000000f2', 'aal2'),
      ('00000000-0000-0000-0000-0000000000f3', 'aal1'), ('00000000-0000-0000-0000-0000000000f3', 'aal2'),
      ('00000000-0000-0000-0000-0000000000f4', 'aal1')
    ) v(who, aal)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', c.who, 'role', 'authenticated', 'aal', c.aal)::text, true);
    set local role authenticated;
    insert into seen select right(c.who, 2), c.aal, public.is_staff(), public.is_admin(), (select count(*) from public.leads);
    reset role;
  end loop;
end $$;

do $$
declare
  r record;
  expected boolean;
begin
  for r in select * from seen loop
    -- enrolled (f1, f2): staff only at aal2. Everyone else: unchanged by this rule (a half-finished enrolment counts as none).
    expected := not (r.who in ('f1', 'f2') and r.aal = 'aal1');
    if r.staff is distinct from expected then
      raise exception 'is_staff() for % at % was %, expected %', r.who, r.aal, r.staff, expected;
    end if;
    if r.admin is distinct from (expected and r.who in ('f1', 'f3', 'f4')) then
      raise exception 'is_admin() for % at % was %', r.who, r.aal, r.admin;
    end if;
    -- and the rows follow: no leads for a password-only session of an enrolled member, all of them otherwise
    if (r.leads > 0) is distinct from expected then
      raise exception 'leads visible to % at %: %', r.who, r.aal, r.leads;
    end if;
  end loop;
end $$;

-- a token without any aal claim (older sessions) counts as aal1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if public.is_staff() then raise exception 'an enrolled member without an aal claim must not be staff'; end if;
end $$;
reset role;

rollback;
