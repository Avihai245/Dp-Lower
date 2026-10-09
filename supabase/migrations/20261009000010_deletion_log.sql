-- A record that an applicant's file was deleted, kept after the file itself is gone: which case, by whom, when.
-- It holds no personal data (the case reference is the firm's own number). Admins can read it; only the server writes it.
create table public.deletion_log (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null,
  deleted_by uuid references public.staff (user_id) on delete set null,
  deleted_by_name text,
  storage_objects int not null default 0,
  deleted_at timestamptz not null default now()
);

alter table public.deletion_log enable row level security;
revoke all on public.deletion_log from anon, authenticated;
grant select on public.deletion_log to authenticated;
grant all on public.deletion_log to service_role;
create policy deletion_log_admin_select on public.deletion_log for select to authenticated
  using (public.is_admin());
