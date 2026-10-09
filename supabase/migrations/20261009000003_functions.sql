-- Helper functions, triggers, the slot-booking transaction and the outbox claim.

create function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger leads_touch before update on public.leads
  for each row execute function public.set_updated_at();
create trigger applications_touch before update on public.applications
  for each row execute function public.set_updated_at();
create trigger documents_touch before update on public.documents
  for each row execute function public.set_updated_at();
create trigger callback_requests_touch before update on public.callback_requests
  for each row execute function public.set_updated_at();
create trigger contact_submissions_touch before update on public.contact_submissions
  for each row execute function public.set_updated_at();

-- "In this stage since ..." follows the stage column.
create function public.leads_stage_since() returns trigger
language plpgsql
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_since = now();
  end if;
  return new;
end
$$;
create trigger leads_stage_since_trg before update on public.leads
  for each row execute function public.leads_stage_since();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies never recurse into RLS)
-- ---------------------------------------------------------------------------

create function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = (select auth.uid()) and s.active
  )
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active and s.role = 'admin'
  )
$$;

create function public.owns_lead(p_lead uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.leads l where l.id = p_lead and l.user_id = (select auth.uid())
  )
$$;

-- Storage paths start with the lead id; a malformed path must not raise inside a policy.
create function public.safe_uuid(p_text text) returns uuid
language plpgsql immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end
$$;

create function public.setting_text(p_key text, p_default text) returns text
language sql stable set search_path = public
as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------------
-- Booking: validates the slot against the weekly template, exceptions and capacity,
-- serialises concurrent attempts on the same slot, and replaces the lead's previous booking.
-- Error codes (message): slot_too_soon, slot_unavailable, slot_full
-- ---------------------------------------------------------------------------

create function public.book_slot(p_lead uuid, p_starts timestamptz, p_tz text default null)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_firm_tz text := public.setting_text('firm_timezone', 'Asia/Jerusalem');
  v_minutes int := public.setting_text('call_minutes', '20')::int;
  v_notice int := public.setting_text('booking_notice_minutes', '120')::int;
  v_local timestamp := p_starts at time zone v_firm_tz;
  v_rule public.availability_rules;
  v_taken int;
  v_row public.bookings;
begin
  if p_starts < now() + make_interval(mins => v_notice) then
    raise exception 'slot_too_soon';
  end if;

  select * into v_rule
  from public.availability_rules r
  where r.active
    and r.weekday = extract(dow from v_local)::int
    and r.start_time = v_local::time
  limit 1;
  if not found then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1 from public.availability_exceptions e
    where e.on_date = v_local::date and (e.start_time is null or e.start_time = v_local::time)
  ) then
    raise exception 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('slot:' || p_starts::text, 0));

  select count(*) into v_taken
  from public.bookings b
  where b.starts_at = p_starts and b.status = 'confirmed' and b.lead_id <> p_lead;
  if v_taken >= v_rule.capacity then
    raise exception 'slot_full';
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now()
  where lead_id = p_lead and status = 'confirmed';

  insert into public.bookings (lead_id, starts_at, ends_at, timezone)
  values (p_lead, p_starts, p_starts + make_interval(mins => v_minutes), p_tz)
  returning * into v_row;

  return v_row;
end
$$;

-- ---------------------------------------------------------------------------
-- Outbox: claim a batch of due events (also reclaims rows stuck in 'processing').
-- ---------------------------------------------------------------------------

create function public.claim_events(p_limit int default 20)
returns setof public.events
language sql security definer set search_path = public
as $$
  update public.events e
     set status = 'processing', attempts = e.attempts + 1, locked_at = now()
   where e.id in (
     select id from public.events
      where next_attempt_at <= now()
        and (status = 'pending' or (status = 'processing' and locked_at < now() - interval '10 minutes'))
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning e.*;
$$;

-- Only the service role may call the privileged functions.
revoke all on function public.book_slot(uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.claim_events(int) from public, anon, authenticated;
revoke all on function public.next_case_ref() from public, anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, text) to service_role;
grant execute on function public.claim_events(int) to service_role;
grant execute on function public.next_case_ref() to service_role;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_lead(uuid) to authenticated;
