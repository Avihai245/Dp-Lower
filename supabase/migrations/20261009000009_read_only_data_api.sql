-- The Data API is read-only for signed-in users.
--
-- Every change to the data is made by our own server code (service role), which checks who is asking, writes the
-- activity log, queues the outbox events and sends the emails. A write made straight through the Data API by a staff
-- account (or a stolen staff session) would skip all of that: a case manager could wipe the booking template, plant
-- history that no one did, or re-point a lead to another user. Signed-in users keep SELECT (applicants their own rows,
-- staff everything, and Realtime relies on it) and lose everything else.

drop policy leads_staff_update on public.leads;
drop policy bookings_staff_update on public.bookings;
drop policy applications_staff_update on public.applications;
drop policy documents_staff_update on public.documents;
drop policy lead_notes_staff on public.lead_notes;
drop policy activity_log_staff_insert on public.activity_log;
drop policy callback_requests_staff_update on public.callback_requests;
drop policy contact_submissions_staff_update on public.contact_submissions;
drop policy availability_rules_staff on public.availability_rules;
drop policy availability_exceptions_staff on public.availability_exceptions;
drop policy staff_admin_insert on public.staff;
drop policy staff_admin_update on public.staff;
drop policy app_settings_admin_update on public.app_settings;

-- the reads that those "for all" policies also covered
create policy lead_notes_staff_select on public.lead_notes for select to authenticated
  using (public.is_staff());
create policy availability_rules_staff_select on public.availability_rules for select to authenticated
  using (public.is_staff());
create policy availability_exceptions_staff_select on public.availability_exceptions for select to authenticated
  using (public.is_staff());

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
