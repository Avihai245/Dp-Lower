-- Defaults the apps rely on. Everything here can be changed later from the CRM (admin) without a deploy.

insert into public.app_settings (key, value) values
  ('firm_timezone', '"Asia/Jerusalem"'),
  ('call_minutes', '20'),
  ('booking_notice_minutes', '120'),
  ('booking_horizon_days', '5')
on conflict (key) do nothing;

-- Weekly call template: Sunday to Thursday (the firm's working week), six slots a day, two calls per slot.
-- weekday: 0 = Sunday ... 6 = Saturday, times in the firm's time zone.
insert into public.availability_rules (weekday, start_time, capacity)
select d, t::time, 2
from generate_series(0, 4) as d,
     unnest(array['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']) as t
where not exists (select 1 from public.availability_rules)
on conflict do nothing;
