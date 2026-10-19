-- Two-step verification for staff, enforced where the data is.
--
-- A staff member who has enrolled an authenticator app (a verified TOTP factor) must have passed the second step before
-- the database treats them as staff: is_staff() / is_admin() answer false for a session that is still at assurance level
-- aal1 (password only). Every row level security policy of the CRM, the staff table and the storage policies for documents
-- go through these two helpers, so a stolen password alone no longer opens the Data API either, not only the CRM pages.
--
-- Staff who have not enrolled are treated exactly as before (enrolment is optional unless the app is told to require
-- it: STAFF_MFA_REQUIRED). The applicants' own policies (owns_lead) are not affected.
--
-- The helpers keep their signature, owner and grants (create or replace), so nothing that calls them changes.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active
      and (
        coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
        or not exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
      )
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active and s.role = 'admin'
      and (
        coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
        or not exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
      )
  )
$$;
