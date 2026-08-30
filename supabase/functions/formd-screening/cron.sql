-- Form D Desk — Investor Mode · OFAC screening schedule (§10/§11). Run once after
-- deploying the formd-screening Edge Function. Requires pg_cron + pg_net. Replace
-- <PROJECT_REF>; keep the service-role key in a Vault secret, not inlined.
--
-- Weekly, Mondays 08:00 UTC — after the rollup has populated firms/principals for
-- the week. The SDN list is refreshed weekly; matching more often adds no signal.
-- Any hit also emits an operational_activity_event immediately, independent of
-- this cadence.

select cron.schedule(
  'formd-screening-weekly',
  '0 8 * * 1',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/formd-screening',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    timeout_milliseconds := 600000
  );
  $$
);

-- To unschedule: select cron.unschedule('formd-screening-weekly');
