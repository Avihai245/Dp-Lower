-- Support for the lead -> account flow (see docs/ARCHITECTURE.md, "Authentication model").

-- Bumped when the mailbox owner proves control of the email; every older lead cookie and emailed link stops working.
alter table public.leads add column session_epoch int not null default 0;

create function public.auth_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

-- Ends every session of a user (refresh tokens cascade). Access tokens already issued expire within the hour.
create function public.revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_user;
end
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
