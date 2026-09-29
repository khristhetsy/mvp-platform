-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925201802. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.


alter table public.intro_requests
  add column if not exists direction text not null default 'investor_to_founder',
  add column if not exists requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists pipeline_investor_id uuid references public.pipeline_investors(id) on delete set null;

alter table public.intro_requests alter column investor_id drop not null;

alter table public.intro_requests
  add constraint intro_requests_direction_check check (direction in ('investor_to_founder','founder_to_investor')),
  add constraint intro_requests_target_check check (investor_id is not null or pipeline_investor_id is not null);

create index if not exists intro_requests_founder_quota_idx
  on public.intro_requests (company_id, created_at) where direction = 'founder_to_investor';

insert into public.platform_settings (key, value)
values ('intro_request_limits', '{
  "founder_basic": {"week": null, "month": 5},
  "founder_professional": {"week": 5, "month": 20},
  "founder_managed_ir": {"week": null, "month": null}
}'::jsonb)
on conflict (key) do nothing;

create or replace function public.founder_intro_quota(p_company_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_founder uuid; v_plan text; v_limits jsonb; v_tz text;
  v_week int; v_month int; v_week_used int; v_month_used int;
  v_week_start timestamptz; v_month_start timestamptz;
begin
  select founder_id into v_founder from companies where id = p_company_id;
  select plan_type into v_plan from subscriptions
   where profile_id = v_founder and role = 'founder' and subscription_status in ('active','internal')
   order by updated_at desc limit 1;
  select coalesce(nullif(timezone,''),'UTC') into v_tz from notification_preferences where user_id = v_founder;
  v_tz := coalesce(v_tz,'UTC');
  v_week_start := date_trunc('week', now() at time zone v_tz) at time zone v_tz;
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;

  select count(*) filter (where created_at >= v_week_start), count(*) filter (where created_at >= v_month_start)
    into v_week_used, v_month_used
    from intro_requests
   where company_id = p_company_id and direction = 'founder_to_investor'
     and status <> 'declined' and created_at >= least(v_week_start, v_month_start);

  if v_plan = 'admin_internal' then
    return jsonb_build_object('plan',v_plan,'can_request',true,'week_limit',null,'month_limit',null,
      'week_used',v_week_used,'month_used',v_month_used,'remaining',null,'week_resets_at',v_week_start + interval '1 week','month_resets_at',v_month_start + interval '1 month');
  end if;

  select value -> v_plan into v_limits from platform_settings where key = 'intro_request_limits';
  if v_plan is null or v_limits is null then
    return jsonb_build_object('plan',v_plan,'can_request',false,'reason','plan_not_eligible',
      'week_used',v_week_used,'month_used',v_month_used);
  end if;

  v_week := nullif(v_limits->>'week','')::int;
  v_month := nullif(v_limits->>'month','')::int;

  return jsonb_build_object(
    'plan', v_plan,
    'week_limit', v_week, 'month_limit', v_month,
    'week_used', v_week_used, 'month_used', v_month_used,
    'can_request', (v_week is null or v_week_used < v_week) and (v_month is null or v_month_used < v_month),
    'reason', case when v_week is not null and v_week_used >= v_week then 'week_limit'
                   when v_month is not null and v_month_used >= v_month then 'month_limit' end,
    'remaining', case when v_week is null and v_month is null then null
                      else least(coalesce(v_week - v_week_used, 2147483647), coalesce(v_month - v_month_used, 2147483647)) end,
    'week_resets_at', v_week_start + interval '1 week',
    'month_resets_at', v_month_start + interval '1 month');
end $$;

create or replace function public.enforce_founder_intro_quota()
returns trigger language plpgsql security definer set search_path = public
as $$
declare q jsonb;
begin
  if new.direction <> 'founder_to_investor' then return new; end if;
  perform pg_advisory_xact_lock(hashtext('founder_intro_quota:' || new.company_id::text));
  q := founder_intro_quota(new.company_id);
  if not coalesce((q->>'can_request')::boolean, false) then
    raise exception 'intro_request_limit: %', coalesce(q->>'reason','not_allowed') using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_enforce_founder_intro_quota
  before insert on public.intro_requests
  for each row execute function public.enforce_founder_intro_quota();

create or replace function public.notify_founder_intro_status()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_founder uuid; v_investor text; v_title text; v_msg text; v_type text;
begin
  if new.direction <> 'founder_to_investor' or new.status is not distinct from old.status then return new; end if;
  select founder_id into v_founder from companies where id = new.company_id;
  if v_founder is null then return new; end if;
  select coalesce(pi.name, p.full_name, 'the investor') into v_investor
    from (select 1) x
    left join pipeline_investors pi on pi.id = new.pipeline_investor_id
    left join profiles p on p.id = new.investor_id;

  if new.status = 'facilitated' then
    v_type := 'founder_intro_facilitated';
    v_title := 'Introduction made';
    v_msg := 'iCFO introduced you to ' || v_investor || '. Their contact details are now on the profile.';
    if new.facilitated_at is null then new.facilitated_at := now(); end if;
  elsif new.status = 'declined' then
    v_type := 'founder_intro_declined';
    v_title := 'Introduction not made';
    v_msg := 'Your introduction to ' || v_investor || ' did not go ahead. The request is back in your allowance.';
  elsif new.status = 'reviewing' then
    v_type := 'founder_intro_reviewing';
    v_title := 'Introduction in review';
    v_msg := 'iCFO is reviewing your introduction to ' || v_investor || '.';
  else
    return new;
  end if;

  insert into notifications (recipient_user_id, actor_user_id, type, title, message, entity_type, entity_id, severity, deep_link, dedupe_key)
  values (v_founder, new.updated_by, v_type, v_title,
          v_msg || coalesce(' Note from iCFO: ' || nullif(new.facilitator_note,''), ''),
          'intro_request', new.id::text, 'info',
          '/founder/investor-pipeline?intro=' || new.id::text,
          v_type || ':' || new.id::text);
  return new;
end $$;

create trigger trg_notify_founder_intro_status
  before update of status on public.intro_requests
  for each row execute function public.notify_founder_intro_status();
