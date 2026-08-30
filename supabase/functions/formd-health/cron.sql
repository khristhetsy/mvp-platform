-- Form D Desk — Investor Mode · health-check schedule (§11). Run once after
-- deploying the formd-health Edge Function. Requires pg_cron + pg_net. Replace
-- <PROJECT_REF>; service-role key in a Vault secret, not inlined.
--
-- Daily 07:45 UTC — after the rollup (07:15) so the ratios reflect the fresh run.
-- Breaches land as formd_health_alert operational events; wire those into the
-- existing admin alerting the same way other operational events surface.

select cron.schedule(
  'formd-health-daily',
  '45 7 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/formd-health',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    timeout_milliseconds := 120000
  );
  $$
);

-- To unschedule: select cron.unschedule('formd-health-daily');
