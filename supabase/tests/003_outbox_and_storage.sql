-- Outbox claiming and storage policies.
begin;

do $$
declare
  v_claimed int;
begin
  -- other work shares this database: set its events aside (the transaction is rolled back at the end)
  update public.events set status = 'sent', delivered_at = now() where status <> 'sent';

  insert into public.events (type, payload, next_attempt_at) values
    ('a', '{}', now() - interval '1 minute'),
    ('b', '{}', now() - interval '1 minute'),
    ('future', '{}', now() + interval '1 hour');
  insert into public.events (type, payload, status, locked_at, next_attempt_at)
    values ('stuck', '{}', 'processing', now() - interval '30 minutes', now() - interval '1 minute');
  insert into public.events (type, payload, status, locked_at, next_attempt_at)
    values ('busy', '{}', 'processing', now(), now() - interval '1 minute');

  select count(*) into v_claimed from public.claim_events(10);
  assert v_claimed = 3, 'claims two pending and the stuck one, not future/busy: ' || v_claimed;
  assert (select count(*) from public.events where status = 'processing') = 4, 'claimed rows are processing (+ busy)';
  assert (select attempts from public.events where type = 'a') = 1, 'attempt counted';
  select count(*) into v_claimed from public.claim_events(10);
  assert v_claimed = 0, 'nothing left to claim';

  -- idempotency key
  insert into public.events (type, dedupe_key) values ('x', 'welcome:1:1');
  begin
    insert into public.events (type, dedupe_key) values ('x', 'welcome:1:1');
    assert false, 'dedupe key must be unique';
  exception when unique_violation then null;
  end;
end $$;

-- storage: an applicant reads files in their own lead folder only ---------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'o@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 's@example.com', 'authenticated', 'authenticated');
insert into public.leads (id, full_name, email, user_id) values
  ('00000000-0000-0000-0000-00000000e001', 'O', 'o@example.com', '00000000-0000-0000-0000-0000000000b1');
insert into storage.objects (bucket_id, name, owner) values
  ('documents', '00000000-0000-0000-0000-00000000e001/passport/x-passport.pdf', null),
  ('documents', '00000000-0000-0000-0000-00000000e999/passport/y-passport.pdf', null),
  ('documents', 'not-a-uuid/file.pdf', null);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from storage.objects where bucket_id = 'documents') = 1, 'owner reads only own folder';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from storage.objects where bucket_id = 'documents') = 0, 'stranger reads nothing';
end $$;
reset role;

rollback;

-- rate limiting
begin;
do $$
declare i int; ok boolean;
begin
  for i in 1..3 loop
    assert public.rate_limit_hit('test:key', 60, 3), 'hit ' || i || ' within limit';
  end loop;
  ok := public.rate_limit_hit('test:key', 60, 3);
  assert not ok, 'fourth hit is limited';
  assert public.rate_limit_hit('test:other', 60, 3), 'keys are independent';
end $$;
rollback;
