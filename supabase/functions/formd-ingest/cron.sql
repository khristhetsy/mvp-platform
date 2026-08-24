-- Form D connector schedules (build spec §4.2, §4.7). Run once after deploying the
-- two Edge Functions. Requires pg_cron + pg_net (Supabase: enable in Dashboard →
-- Database → Extensions). Replace <PROJECT_REF> and set the service-role key in a
-- Vault secret rather than inlining it.

-- Daily ingest — 07:00 UTC weekdays (09:00 CET); EDGAR's prior-day index is complete.
select cron.schedule(
  'formd-ingest-daily',
  '0 7 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/formd-ingest',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    timeout_milliseconds := 600000
  );
  $$
);

-- Nightly recompute — 03:00 UTC daily. Surfaces leads aging into the stall window.
select cron.schedule(
  'formd-recompute-nightly',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/formd-recompute',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    timeout_milliseconds := 300000
  );
  $$
);

-- To unschedule: select cron.unschedule('formd-ingest-daily');
