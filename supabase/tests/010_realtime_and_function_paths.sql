-- The CRM listens to every table whose changes it shows, and no helper function resolves names in the caller's path.
begin;

do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
  from unnest(array['leads', 'documents', 'applications', 'lead_notes', 'activity_log', 'callback_requests', 'contact_submissions', 'bookings']) as t
  where not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t);
  assert missing is null, 'not in the realtime publication: ' || coalesce(missing, '');

  -- every function of the public schema has a fixed search_path (security advisor 0011)
  select string_agg(p.proname, ', ') into missing
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert missing is null, 'functions without a fixed search_path: ' || coalesce(missing, '');
end $$;

rollback;
