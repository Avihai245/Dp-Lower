-- The CRM shows "x of 5 sections" for every applicant; autosaves write only to `applications`, so without this table in
-- the publication the count changed on screen only after a navigation or a tab refocus. RLS still applies to Realtime:
-- only staff receive these rows.
alter publication supabase_realtime add table public.applications;
