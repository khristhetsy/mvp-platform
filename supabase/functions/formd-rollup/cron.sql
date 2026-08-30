-- Form D Desk — Investor Mode rollup schedule (spec §4). Run once after deploying
-- the formd-rollup Edge Function. Requires pg_cron + pg_net. Replace <PROJECT_REF>
-- and keep the service-role key in a Vault secret, not inlined.
--
-- Chained ~15 minutes after the daily issuer ingest (07:00 UTC) so it never runs
-- concurrent with it. Full recompute — cheap at this volume; prefer it over an
-- incremental merge until it stops being cheap (incremental identity resolution is
-- where this class of system rots).

select cron.schedule(
  'formd-rollup-daily',
  '15 7 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/formd-rollup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    timeout_milliseconds := 600000
  );
  $$
);

-- To unschedule: select cron.unschedule('formd-rollup-daily');
