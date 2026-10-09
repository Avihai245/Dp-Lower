-- Case references are DPL-YY-NNNN: at least four digits. lpad() CUTS a longer number to four characters, so after about
-- 9,000 leads every new reference repeated an old one and the insert failed. Pad short numbers, never cut long ones.
create function public.format_case_ref(n bigint, at timestamptz default now()) returns text
language sql stable
as $$
  select 'DPL-' || to_char(at at time zone 'Asia/Jerusalem', 'YY') || '-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end
$$;

create or replace function public.next_case_ref() returns text
language sql volatile
as $$
  select public.format_case_ref(nextval('public.case_ref_seq'))
$$;

revoke all on function public.format_case_ref(bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.format_case_ref(bigint, timestamptz) to service_role;
