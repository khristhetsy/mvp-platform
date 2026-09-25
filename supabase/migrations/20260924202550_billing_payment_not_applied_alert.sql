-- Applied to production directly on 2026-09-24 and recorded in migration history
-- as version 20260924202550. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

create or replace function public.flag_unapplied_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with latest_consent as (
    select distinct on (b.profile_id) b.id, b.profile_id, b.email, b.plan_type, b.accepted_at
    from billing_consents b
    order by b.profile_id, b.accepted_at desc
  )
  insert into operational_activity_events
    (event_type, event_category, entity_type, entity_id, related_user_id, severity,
     title, description, metadata, source_module, visibility)
  select 'billing.payment_not_applied', 'system', 'profile', lc.profile_id, lc.profile_id, 'high',
         'Paid plan not applied: ' || coalesce(p.full_name, lc.email),
         coalesce(p.full_name, lc.email) || ' accepted billing for ' || lc.plan_type ||
         ' at ' || to_char(lc.accepted_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') ||
         ' UTC, but the account is still ' || coalesce(s.plan_type, 'no plan') || ' / ' ||
         coalesce(s.subscription_status, 'no subscription') ||
         '. Confirm payment and activate the plan.',
         jsonb_build_object('consent_id', lc.id, 'email', lc.email,
                            'consented_plan', lc.plan_type,
                            'current_plan', s.plan_type,
                            'current_status', s.subscription_status,
                            'subscription_id', s.id),
         'billing_watchdog', 'admin_only'
  from latest_consent lc
  join profiles p on p.id = lc.profile_id
  left join subscriptions s on s.profile_id = lc.profile_id
  where lc.accepted_at < now() - interval '30 minutes'
    and not (coalesce(s.subscription_status, '') = 'active' and s.plan_type = lc.plan_type)
    and not exists (
      select 1 from operational_activity_events e
      where e.event_type = 'billing.payment_not_applied'
        and e.metadata->>'consent_id' = lc.id::text
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.flag_unapplied_payments() from public, anon, authenticated;

select cron.schedule('billing-payment-not-applied', '*/15 * * * *', $$select public.flag_unapplied_payments();$$);
