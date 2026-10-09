-- Availability per lawyer (the plan: "working hours per lawyer", "unique on (staff_id, starts_at)", "availability
-- calendar per lawyer").
--
-- A weekly rule or a blocked day/slot now belongs to a scope:
--   staff_id = a lawyer   that lawyer's own hours (one call at a time, so capacity is always 1) and own days off;
--   staff_id is null      a rule: the unassigned (pooled) template, N calls per slot, which is what every rule was before
--                         this migration, so nothing changes until lawyers set their hours;
--                         a blocked day/slot: closed for everyone, every lawyer and the pooled template.
-- A booking taken from a lawyer's hours carries assigned_to; a lawyer never holds two confirmed calls at the same time.
-- Only active staff with the role 'lawyer' are offered (book_slot and the availability API check it), so deactivating
-- a lawyer stops new bookings while their rules and their booked calls stay. Deleting the person removes their rules
-- and blocked days (cascade); their calls stay booked and become unassigned (assigned_to is `on delete set null`).
--
-- Additive and safe to run twice.

alter table public.availability_rules
  add column if not exists staff_id uuid references public.staff (user_id) on delete cascade;
alter table public.availability_exceptions
  add column if not exists staff_id uuid references public.staff (user_id) on delete cascade;

comment on column public.availability_rules.staff_id is
  'The lawyer whose weekly hours this is (one call at a time); null = the unassigned template (capacity calls per slot).';
comment on column public.availability_exceptions.staff_id is
  'The lawyer who is away; null = closed for everyone.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'availability_rules_lawyer_capacity') then
    alter table public.availability_rules
      add constraint availability_rules_lawyer_capacity check (staff_id is null or capacity = 1);
  end if;
  -- one row per scope, weekday and time (two lawyers may both offer 10:30; the pooled template counts as one scope)
  if not exists (select 1 from pg_constraint where conname = 'availability_rules_scope_uq') then
    alter table public.availability_rules
      add constraint availability_rules_scope_uq unique nulls not distinct (staff_id, weekday, start_time);
  end if;
end $$;
alter table public.availability_rules drop constraint if exists availability_rules_weekday_start_time_key;

create unique index if not exists availability_exceptions_scope_uq
  on public.availability_exceptions (staff_id, on_date, start_time) nulls not distinct;
drop index if exists public.availability_exceptions_uq;

create index if not exists availability_rules_staff_idx on public.availability_rules (staff_id) where staff_id is not null;
create index if not exists availability_exceptions_staff_idx on public.availability_exceptions (staff_id) where staff_id is not null;

-- A lawyer takes one call at a time.
create unique index if not exists bookings_one_call_per_lawyer
  on public.bookings (assigned_to, starts_at) where status = 'confirmed' and assigned_to is not null;
create index if not exists bookings_assigned_idx on public.bookings (assigned_to) where assigned_to is not null;
