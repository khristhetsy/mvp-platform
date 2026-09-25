-- Applied to production directly on 2026-09-24 and recorded in migration history
-- as version 20260924211832. This file is the exact SQL production ran, taken from
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
  create temporary table _stuck on commit drop as
  with latest_consent as (
    select distinct on (b.profile_id) b.id, b.profile_id, b.email, b.plan_type, b.accepted_at
    from billing_consents b
    order by b.profile_id, b.accepted_at desc
  )
  select lc.id as consent_id, lc.profile_id, lc.email, lc.plan_type, lc.accepted_at,
         coalesce(p.full_name, lc.email) as who,
         s.id as subscription_id, s.plan_type as cur_plan, s.subscription_status as cur_status
  from latest_consent lc
  join profiles p on p.id = lc.profile_id
  left join subscriptions s on s.profile_id = lc.profile_id
  where lc.accepted_at < now() - interval '15 minutes'
    and not (coalesce(s.subscription_status, '') = 'active' and s.plan_type = lc.plan_type)
    and not exists (
      select 1 from operational_activity_events e
      where e.event_type = 'billing.payment_not_applied'
        and e.metadata->>'consent_id' = lc.id::text
    );

  insert into operational_activity_events
    (event_type, event_category, entity_type, entity_id, related_user_id, severity,
     title, description, metadata, source_module, visibility)
  select 'billing.payment_not_applied', 'system', 'profile', st.profile_id, st.profile_id, 'high',
         'Paid plan not applied: ' || st.who,
         st.who || ' accepted billing for ' || st.plan_type || ' at ' ||
         to_char(st.accepted_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') ||
         ' UTC, but the account is still ' || coalesce(st.cur_plan, 'no plan') || ' / ' ||
         coalesce(st.cur_status, 'no subscription') || '. Confirm payment and activate the plan.',
         jsonb_build_object('consent_id', st.consent_id, 'email', st.email,
                            'consented_plan', st.plan_type, 'current_plan', st.cur_plan,
                            'current_status', st.cur_status, 'subscription_id', st.subscription_id),
         'billing_watchdog', 'admin_only'
  from _stuck st;
  get diagnostics n = row_count;

  insert into notifications
    (recipient_user_id, type, title, message, entity_type, entity_id, severity, deep_link, dedupe_key)
  select a.id, 'billing_payment_not_applied',
         'Paid plan not applied: ' || st.who,
         st.who || ' (' || st.email || ') accepted billing for ' || st.plan_type ||
         ' but is still ' || coalesce(st.cur_plan, 'no plan') || ' / ' ||
         coalesce(st.cur_status, 'no subscription') || '. Confirm payment and activate the plan.',
         'profile', st.profile_id::text, 'critical', '/admin',
         'billing_payment_not_applied:' || st.consent_id || ':' || a.id
  from _stuck st
  cross join (select id from profiles where is_super_admin) a;

  return n;
end;
$$;

revoke all on function public.flag_unapplied_payments() from public, anon, authenticated;
