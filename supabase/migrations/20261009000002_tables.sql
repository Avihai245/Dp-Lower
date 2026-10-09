-- Core tables. All writes from the public apps go through server routes using the service role;
-- row level security (next migration) only has to cover reads by the owner and by staff.

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.staff_role not null default 'case_manager',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Case references look like DPL-26-1001.
create sequence public.case_ref_seq start with 1001;

create function public.next_case_ref() returns text
language sql volatile
as $$
  select 'DPL-' || to_char(now() at time zone 'Asia/Jerusalem', 'YY') || '-' || lpad(nextval('public.case_ref_seq')::text, 4, '0')
$$;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null unique default public.next_case_ref(),
  -- Supabase auth user. Created together with the lead so the applicant can open the portal without a password.
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  locale public.locale_code not null default 'en',
  route public.lead_route,
  answers jsonb not null default '{}'::jsonb,
  source text not null default 'campaign-ger-aus',
  utm jsonb not null default '{}'::jsonb,
  stage public.lead_stage not null default 'lead',
  stage_since timestamptz not null default now(),
  status public.lead_status not null default 'enquiry',
  owner_id uuid references public.staff (user_id) on delete set null,
  consented_at timestamptz,
  email_verified_at timestamptz,
  account_created_at timestamptz,
  password_set_at timestamptz,
  application_started_at timestamptz,
  submitted_at timestamptz,
  unsubscribed_at timestamptz,
  result_emailed_at timestamptz,
  tour_done boolean not null default false,
  next_action_done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_email_lowercase check (email = lower(email)),
  constraint leads_email_unique unique (email)
);
create index leads_stage_idx on public.leads (stage);
create index leads_status_idx on public.leads (status);
create index leads_created_idx on public.leads (created_at desc);
create index leads_owner_idx on public.leads (owner_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  assigned_to uuid references public.staff (user_id) on delete set null,
  -- the visitor's IANA time zone at booking time (for emails and the CRM)
  timezone text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index bookings_starts_idx on public.bookings (starts_at);
create unique index bookings_one_active_per_lead on public.bookings (lead_id) where status = 'confirmed';

-- Weekly template for bookable call slots, in the firm's time zone (weekday 0 = Sunday).
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  capacity smallint not null default 2 check (capacity >= 0),
  active boolean not null default true,
  unique (weekday, start_time)
);

-- Blocked days (start_time null) or single slots, in the firm's time zone.
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  start_time time,
  reason text,
  created_at timestamptz not null default now()
);
create unique index availability_exceptions_uq on public.availability_exceptions (on_date, coalesce(start_time, '00:00'::time));

-- One row per lead: the online application. `data` is keyed by the field ids in @dpl/core (APPLICATION_SECTIONS).
create table public.applications (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  current_section smallint not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One row per (lead, document slot); the slot keys are DOC_TYPES in @dpl/core.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  doc_type text not null,
  status public.doc_status not null default 'missing',
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz,
  requested_at timestamptz,
  reviewed_by uuid references public.staff (user_id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, doc_type)
);
create index documents_lead_idx on public.documents (lead_id);

-- Internal notes: never shown to the applicant.
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid references public.staff (user_id) on delete set null,
  author_name text,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);

-- Documented history: kind 'staff' = something the team did, 'system' = a milestone from the case record.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null default 'system' check (kind in ('system', 'staff')),
  actor_id uuid references public.staff (user_id) on delete set null,
  actor_name text,
  code text,
  text text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_lead_idx on public.activity_log (lead_id, created_at desc);

-- "Speak with an AI Advisor / get a call in seconds" requests. A voice integration can consume this queue later.
create table public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  name text,
  phone text not null,
  locale public.locale_code not null default 'en',
  source text,
  status public.inbox_status not null default 'new',
  handled_by uuid references public.staff (user_id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index callback_requests_status_idx on public.callback_requests (status, created_at desc);

-- Forms on the firm's own website (consultation form, lead band, chat).
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact' check (kind in ('contact', 'lead_band', 'chat')),
  name text not null,
  email text,
  phone text,
  matter text,
  note text,
  locale public.locale_code not null default 'en',
  page text,
  source text,
  utm jsonb not null default '{}'::jsonb,
  consented_at timestamptz,
  status public.inbox_status not null default 'new',
  handled_by uuid references public.staff (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_submissions_status_idx on public.contact_submissions (status, created_at desc);

-- Transactional outbox. A dispatcher delivers rows to the Zapier webhooks (see apps/campaign /api/cron/dispatch).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  channel public.event_channel not null default 'crm',
  lead_id uuid references public.leads (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  status public.event_status not null default 'pending',
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index events_dispatch_idx on public.events (status, next_attempt_at);
create index events_lead_idx on public.events (lead_id, created_at desc);

-- Progress of the 15-email nurture sequence per lead.
create table public.email_sequence_state (
  lead_id uuid not null references public.leads (id) on delete cascade,
  number smallint not null check (number between 1 and 15),
  status public.sequence_status not null,
  reason text,
  scheduled_for timestamptz not null,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lead_id, number)
);
