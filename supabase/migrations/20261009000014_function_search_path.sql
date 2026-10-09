-- Supabase security advisor 0011 (function_search_path_mutable): five helper functions had no fixed search_path, so the
-- names they use were resolved in the caller's path. None of them is security definer, but pinning the path removes the
-- warning and the possibility with it.
alter function public.format_case_ref(bigint, timestamptz) set search_path = public;
alter function public.next_case_ref() set search_path = public;
alter function public.leads_stage_since() set search_path = public;
alter function public.safe_uuid(text) set search_path = public;
alter function public.set_updated_at() set search_path = public;
