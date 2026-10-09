-- The booking transaction with lawyers (see 20261009000100_per_lawyer_availability.sql), and the clean-up of calls whose
-- time has passed. Same name, arguments and error codes as before: slot_too_soon, slot_unavailable, slot_full.
--
-- Under the per-slot lock, book_slot collects every provider that offers the time:
--   - each active lawyer with an active rule at that weekday and time who is not away (own blocked day or slot), and
--   - the unassigned template, when it has an active rule at that time;
-- a time that is closed for everyone offers nobody. Nobody offers it: slot_unavailable. Somebody offers it but every one
-- of them is taken: slot_full. Otherwise the call goes to the free lawyer with the fewest confirmed calls in the coming
-- seven days (then the lowest staff id), and only when no lawyer is free to a seat of the unassigned template
-- (assigned_to null). The lead's own confirmed call is not counted anywhere: it is the one being replaced.
--
-- The lead holds one confirmed call at a time: the previous one is cancelled, or, when its time has already passed,
-- recorded as held ('completed', with an activity line), so a lead whose call is over can book again.

create or replace function public.book_slot(p_lead uuid, p_starts timestamptz, p_tz text default null)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_firm_tz text := public.setting_text('firm_timezone', 'Asia/Jerusalem');
  v_minutes int := public.setting_text('call_minutes', '20')::int;
  v_notice int := public.setting_text('booking_notice_minutes', '120')::int;
  v_local timestamp := p_starts at time zone v_firm_tz;
  v_date date := v_local::date;
  v_time time := v_local::time;
  v_dow int := extract(dow from v_local)::int;
  v_lawyers uuid[];
  v_pool smallint;
  v_staff uuid;
  v_row public.bookings;
begin
  if p_starts < now() + make_interval(mins => v_notice) then
    raise exception 'slot_too_soon';
  end if;

  -- closed for everyone
  if exists (
    select 1 from public.availability_exceptions e
    where e.staff_id is null and e.on_date = v_date and (e.start_time is null or e.start_time = v_time)
  ) then
    raise exception 'slot_unavailable';
  end if;

  -- the lawyers who offer this time
  select coalesce(array_agg(r.staff_id order by r.staff_id), '{}') into v_lawyers
  from public.availability_rules r
  join public.staff s on s.user_id = r.staff_id and s.active and s.role = 'lawyer'
  where r.active and r.weekday = v_dow and r.start_time = v_time
    and not exists (
      select 1 from public.availability_exceptions e
      where e.staff_id = r.staff_id and e.on_date = v_date and (e.start_time is null or e.start_time = v_time)
    );

  -- the unassigned template (at most one rule per weekday and time)
  select r.capacity into v_pool
  from public.availability_rules r
  where r.staff_id is null and r.active and r.weekday = v_dow and r.start_time = v_time;

  if cardinality(v_lawyers) = 0 and v_pool is null then
    raise exception 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('slot:' || p_starts::text, 0));

  select l.id into v_staff
  from unnest(v_lawyers) as l(id)
  where not exists (
    select 1 from public.bookings b
    where b.assigned_to = l.id and b.starts_at = p_starts and b.status = 'confirmed' and b.lead_id <> p_lead
  )
  order by (
    select count(*) from public.bookings b
    where b.assigned_to = l.id and b.status = 'confirmed' and b.lead_id <> p_lead
      and b.starts_at >= now() and b.starts_at < now() + interval '7 days'
  ), l.id
  limit 1;

  if v_staff is null and (
    v_pool is null
    or v_pool <= (
      select count(*) from public.bookings b
      where b.starts_at = p_starts and b.status = 'confirmed' and b.assigned_to is null and b.lead_id <> p_lead
    )
  ) then
    raise exception 'slot_full';
  end if;

  with replaced as (
    update public.bookings
       set status = case when ends_at <= now() then 'completed'::public.booking_status else 'cancelled'::public.booking_status end,
           cancelled_at = case when ends_at <= now() then cancelled_at else now() end
     where lead_id = p_lead and status = 'confirmed'
    returning id, starts_at, status
  )
  insert into public.activity_log (lead_id, kind, code, text, meta)
  select p_lead, 'system', 'booking_completed', 'Call date passed; marked as held',
         jsonb_build_object('bookingId', id, 'startsAt', to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  from replaced
  where status = 'completed';

  insert into public.bookings (lead_id, starts_at, ends_at, timezone, assigned_to)
  values (p_lead, p_starts, p_starts + make_interval(mins => v_minutes), p_tz, v_staff)
  returning * into v_row;

  return v_row;
end
$$;

-- ---------------------------------------------------------------------------
-- Calls whose end is before p_before and that nobody marked (held, no-show, cancelled) are recorded as held, with one
-- activity line each. Run by the dispatcher (/api/cron/dispatch) with p_before = now - 24 hours, which leaves the team a
-- day to mark a no-show. Safe to run twice and from two places at once (rows are claimed with skip locked).
-- Returns how many calls were marked.
-- ---------------------------------------------------------------------------

create or replace function public.complete_past_bookings(p_before timestamptz, p_limit int default 500)
returns integer
language sql security definer set search_path = public
as $$
  with due as (
    select id from public.bookings
     where status = 'confirmed' and ends_at < p_before
     order by ends_at
     limit greatest(p_limit, 0)
     for update skip locked
  ), done as (
    update public.bookings b
       set status = 'completed'
      from due
     where b.id = due.id and b.status = 'confirmed'
    returning b.id, b.lead_id, b.starts_at
  ), logged as (
    insert into public.activity_log (lead_id, kind, code, text, meta)
    select lead_id, 'system', 'booking_completed', 'Call date passed; marked as held',
           jsonb_build_object('bookingId', id, 'startsAt', to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      from done
    returning 1
  )
  select count(*)::int from logged;
$$;

revoke all on function public.book_slot(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, text) to service_role;
revoke all on function public.complete_past_bookings(timestamptz, int) from public, anon, authenticated;
grant execute on function public.complete_past_bookings(timestamptz, int) to service_role;
