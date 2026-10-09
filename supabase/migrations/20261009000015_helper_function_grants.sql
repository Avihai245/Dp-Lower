-- Hardening found by the Supabase security advisor on the hosted project (lints 0028 / 0029).
--
-- is_staff(), is_admin() and owns_lead() are security-definer helpers of the row level security policies. Every policy
-- that uses them is `to authenticated`, so a visitor who is not signed in never needs to run them; the Data API exposed
-- them to `anon` all the same (/rest/v1/rpc/is_staff). Signed-in users keep them: the policies evaluate them as the caller
-- and the sign-in page asks is_staff() to decide where to go. They answer only about the caller's own identity.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.owns_lead(uuid) from public, anon;

-- The hosted platform installs an event trigger (ensure_rls) with this security-definer function in `public`; nobody
-- calls it through the API. Event triggers run with the owner's rights, so closing the API route changes nothing else.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
