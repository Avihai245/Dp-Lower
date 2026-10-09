-- Domain enums. Values are stable machine keys; all display text lives in the apps' i18n files.

create type public.locale_code as enum ('en', 'he');

-- Which route the lead's family history points to (quiz question 1).
create type public.lead_route as enum ('germany', 'austria', 'both', 'unsure');

-- Pipeline stage: the six columns of the CRM board.
create type public.lead_stage as enum ('lead', 'account', 'application', 'review', 'filed', 'granted');

-- Applicant-facing status (Lead Flow step 12/13 plus the admin "status shown to the applicant" options).
create type public.lead_status as enum (
  'enquiry',
  'account_created',
  'application_incomplete',
  'application_submitted',
  'under_review',
  'info_required',
  'review_completed',
  'contacting'
);

-- Per-document state as the firm sees it.
create type public.doc_status as enum ('missing', 'requested', 'received', 'reupload');

create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');

create type public.staff_role as enum ('admin', 'lawyer', 'case_manager');

-- Outbox: 'crm' events go to the CRM webhook, 'email' events carry a fully rendered email.
create type public.event_channel as enum ('crm', 'email');
create type public.event_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');

-- Inbox items for the firm (callback requests, contact submissions).
create type public.inbox_status as enum ('new', 'in_progress', 'closed');

create type public.sequence_status as enum ('queued', 'sent', 'skipped');
