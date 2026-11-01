-- Before and after results for database load fixes (Admin, System health, Database health).
--
-- One row per area that was fixed, plus one "total" row. Each row holds requests per
-- day counted from the Supabase API log over 24 hours:
--   before_per_day     measured in the 24 hours before the fix
--   projected_per_day  what the fix should bring it to (arithmetic, not a measurement)
--   after_per_day      measured over the first full 24 hours after the fix; null until then
--
-- Rows are filled by hand from the API log. The page shows only what is stored, so a
-- row with a null after_per_day reads "Not measured yet".
--
-- Roles: staff may read. Nobody writes through the API; writes use the service role,
-- which bypasses RLS.

create table if not exists public.db_health_fix_results (
  area              text primary key,
  label             text not null,
  step              integer,
  sort_order        integer not null default 0,
  fixed_at          timestamptz,
  before_per_day    integer not null,
  projected_per_day integer not null,
  after_per_day     integer,
  measured_at       timestamptz,
  source            text not null default 'Supabase API log, 24 hours',
  note              text
);

alter table public.db_health_fix_results enable row level security;

drop policy if exists db_health_fix_results_staff_read on public.db_health_fix_results;
create policy db_health_fix_results_staff_read on public.db_health_fix_results
  for select to authenticated
  using ((select public.is_staff()));

insert into public.db_health_fix_results (area, label, step, sort_order, fixed_at, before_per_day, projected_per_day, note)
values
  ('total',     'All requests',         null, 0, '2026-11-01 18:41:00+00', 124903, 86921, null),
  ('sequences', 'Marketing sequences',  1,    1, '2026-11-01 18:41:00+00',  24517,    96, 'The unsubscribe list is read once per run and prior events once per group, not once per contact.'),
  ('profiles',  'Profile reads',        2,    2, '2026-11-01 18:41:00+00',  21287, 15735, 'The sign in check reads the profile once instead of twice.'),
  ('job_log',   'Scheduled job log',    2,    3, '2026-11-01 18:41:00+00',   7596,  5068, 'Old log rows are trimmed at most every 6 hours per server instance.'),
  ('settings',  'Settings',             3,    4, '2026-11-01 18:41:00+00',   8361,  2880, 'On/off settings are kept for 60 seconds. Projected for one server instance, so more instances means a higher number.')
on conflict (area) do nothing;
