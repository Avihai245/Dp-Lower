-- Row level security.
-- Principle: visitors and applicants never write tables directly. They call our server routes, which use the
-- service role after checking the lead cookie or the Supabase session. RLS therefore only has to allow
--   (a) an applicant to READ their own rows, and
--   (b) staff to read and manage everything (CRM, realtime).

alter table public.app_settings enable row level security;
alter table public.staff enable row level security;
alter table public.leads enable row level security;
alter table public.bookings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.applications enable row level security;
alter table public.documents enable row level security;
alter table public.lead_notes enable row level security;
alter table public.activity_log enable row level security;
alter table public.callback_requests enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.events enable row level security;
alter table public.email_sequence_state enable row level security;

-- Data API privileges. Supabase grants every new public table to all API roles by default; start from nothing
-- instead. Nothing is exposed to `anon`; `authenticated` gets only what is granted below, narrowed by policies.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on public.leads, public.bookings, public.applications, public.documents to authenticated;
grant select, insert, update, delete on public.lead_notes, public.availability_rules, public.availability_exceptions to authenticated;
grant select, insert on public.activity_log to authenticated;
grant select, update on public.callback_requests, public.contact_submissions to authenticated;
grant select, update on public.leads, public.bookings, public.documents, public.applications to authenticated;
grant select on public.staff, public.app_settings, public.events, public.email_sequence_state to authenticated;
grant update on public.app_settings to authenticated;
grant insert, update on public.staff to authenticated;

-- leads ----------------------------------------------------------------------
create policy leads_select on public.leads for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy leads_staff_update on public.leads for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- bookings -------------------------------------------------------------------
create policy bookings_select on public.bookings for select to authenticated
  using (public.owns_lead(lead_id) or public.is_staff());
create policy bookings_staff_update on public.bookings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- applications ---------------------------------------------------------------
create policy applications_select on public.applications for select to authenticated
  using (public.owns_lead(lead_id) or public.is_staff());
create policy applications_staff_update on public.applications for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- documents ------------------------------------------------------------------
create policy documents_select on public.documents for select to authenticated
  using (public.owns_lead(lead_id) or public.is_staff());
create policy documents_staff_update on public.documents for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- staff-only tables ------------------------------------------------------------
create policy lead_notes_staff on public.lead_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy activity_log_staff_select on public.activity_log for select to authenticated
  using (public.is_staff());
create policy activity_log_staff_insert on public.activity_log for insert to authenticated
  with check (public.is_staff());
create policy callback_requests_staff_select on public.callback_requests for select to authenticated
  using (public.is_staff());
create policy callback_requests_staff_update on public.callback_requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy contact_submissions_staff_select on public.contact_submissions for select to authenticated
  using (public.is_staff());
create policy contact_submissions_staff_update on public.contact_submissions for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy availability_rules_staff on public.availability_rules for all to authenticated
  using (public.is_staff()) with check (public.is_admin());
create policy availability_exceptions_staff on public.availability_exceptions for all to authenticated
  using (public.is_staff()) with check (public.is_admin());
create policy events_staff_select on public.events for select to authenticated
  using (public.is_staff());
create policy email_sequence_state_staff_select on public.email_sequence_state for select to authenticated
  using (public.is_staff());

-- staff directory --------------------------------------------------------------
create policy staff_select on public.staff for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));
create policy staff_admin_insert on public.staff for insert to authenticated
  with check (public.is_admin());
create policy staff_admin_update on public.staff for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- settings -----------------------------------------------------------------------
create policy app_settings_select on public.app_settings for select to authenticated
  using (public.is_staff());
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
