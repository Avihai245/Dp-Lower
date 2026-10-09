-- Private bucket for the applicant's family records. Object paths: {lead_id}/{doc_type}/{uuid}-{file name}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads normally use signed upload URLs created by the server; these policies are the safety net for
-- reads (applicant's own folder and staff) and for staff housekeeping.
create policy "documents owner or staff read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (public.owns_lead(public.safe_uuid((storage.foldername(name))[1])) or public.is_staff())
  );
create policy "documents owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.owns_lead(public.safe_uuid((storage.foldername(name))[1]))
  );
create policy "documents staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_staff());

-- Live CRM updates (RLS applies to Realtime: only staff receive these rows).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table
  public.leads, public.documents, public.lead_notes, public.activity_log,
  public.callback_requests, public.contact_submissions, public.bookings;

-- One row per lead with the counters the CRM list and board need. RLS of the base tables applies.
create view public.admin_lead_rows with (security_invoker = true) as
select
  l.*,
  coalesce(d.received, 0)::int as docs_received,
  coalesce(n.cnt, 0)::int as notes_count,
  b.starts_at as next_call_at,
  a.data as application_data,
  a.current_section as application_section,
  a.completed_at as application_completed_at
from public.leads l
left join lateral (
  select count(*) filter (where status = 'received') as received
  from public.documents where lead_id = l.id
) d on true
left join lateral (
  select count(*) as cnt from public.lead_notes where lead_id = l.id
) n on true
left join lateral (
  select starts_at from public.bookings
  where lead_id = l.id and status = 'confirmed' and starts_at > now()
  order by starts_at limit 1
) b on true
left join public.applications a on a.lead_id = l.id;

grant select on public.admin_lead_rows to authenticated;
grant select on public.admin_lead_rows to service_role;
