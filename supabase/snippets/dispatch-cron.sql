-- Documentation snippet, NOT a migration (it contains a secret and project-specific URLs).
--
-- Runs the dispatcher (POST /api/cron/dispatch: schedules the due nurture emails, delivers the outbox to the Zapier
-- webhooks) from inside Supabase with pg_cron + pg_net. Use it instead of Vercel Cron when the Vercel plan is Hobby:
-- Hobby only allows cron jobs that run once a day, and `*/5 * * * *` in apps/campaign/vercel.json would be rejected
-- at deploy time (remove the "crons" block from vercel.json in that case). On Vercel Pro the file in the repo is enough.
--
-- A booking confirmation or a password reset should leave within a minute or two, so a daily run is not an option.
--
-- 1. Enable the extensions once (Dashboard > Database > Extensions, or the two lines below).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Keep the shared secret in Vault, not in the job text. Use the same value as CRON_SECRET in the app's environment.
select vault.create_secret('<CRON_SECRET>', 'dpl_cron_secret', 'Bearer token of POST /api/cron/dispatch');
--    (to rotate it later: select vault.update_secret((select id from vault.secrets where name = 'dpl_cron_secret'), '<NEW_SECRET>');)

-- 3. Schedule the call (every minute; every 5 minutes is plenty if you prefer: '*/5 * * * *').
--    Replace the URL with the production domain of the campaign app.
select cron.schedule(
  'dpl-dispatch',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://euro-passports.com/api/cron/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dpl_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- Check that it runs (the HTTP status of the last calls: 200 means the dispatcher answered with its counts).
-- select jobid, jobname, schedule, active from cron.job where jobname = 'dpl-dispatch';
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- select id, status_code, left(content::text, 200) as body, created from net._http_response order by created desc limit 5;

-- Pause / remove:
-- select cron.alter_job((select jobid from cron.job where jobname = 'dpl-dispatch'), active := false);
-- select cron.unschedule('dpl-dispatch');

-- Local development: the database container cannot reach http://localhost:3001; use
--   url := 'http://host.docker.internal:3001/api/cron/dispatch'
-- or simply call the endpoint by hand:
--   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/dispatch
