-- Applied to production directly on 2026-09-24 and recorded in migration history
-- as version 20260924163753. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

CREATE OR REPLACE FUNCTION public.refresh_meeting_kpi_goals(p_as_of date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d record; per text; ps date; v numeric; n int := 0;
begin
  if coalesce(auth.role(), '') not in ('service_role', '') and not public.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for d in select id from public.ceo_kpi_meeting_definitions where is_active loop
    foreach per in array array['weekly','monthly','quarterly','yearly'] loop
      v := public.calc_meeting_kpi_goal(d.id, per, p_as_of);
      ps := case per
        when 'weekly' then date_trunc('week', p_as_of)::date
        when 'monthly' then date_trunc('month', p_as_of)::date
        when 'quarterly' then date_trunc('quarter', p_as_of)::date
        else date_trunc('year', p_as_of)::date end;
      insert into public.ceo_kpi_meeting_goal_values (kpi_id, period, period_start, value)
      values (d.id, per, ps, v)
      on conflict (kpi_id, period, period_start) do update set value = excluded.value;
      n := n + 1;
    end loop;
  end loop;
  return n;
end; $function$;

CREATE OR REPLACE FUNCTION public.dd_seed_engagement(eid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if coalesce(auth.role(), '') not in ('service_role', '') and not public.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.dd_domains (engagement_id, code, name, sort_order) values
    (eid,'D-01','Structure',1),
    (eid,'D-02','Market',2),
    (eid,'D-03','Competitive',3),
    (eid,'D-04','Sales',4),
    (eid,'D-05','Financial',5)
  on conflict (engagement_id, code) do nothing;

  insert into public.dd_visibility_gate (engagement_id, section, founder_visible, investor_visible) values
    (eid,'findings',    false,false),
    (eid,'responses',   false,false),
    (eid,'data_room',   false,false),
    (eid,'candor',      false,false),
    (eid,'icfo_review', false,false),
    (eid,'verdict',     false,false)
  on conflict (engagement_id, section) do nothing;
end; $function$;

CREATE OR REPLACE FUNCTION public.sales_bulk_add_assignees(p_member_ids uuid[], p_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  if coalesce(auth.role(), '') not in ('service_role', '') and not public.is_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.crm_contacts c
  set assignee_ids = (select array(select distinct e from unnest(coalesce(c.assignee_ids,'{}') || p_member_ids) as e))
  where c.id = any(p_ids);
  get diagnostics n = row_count; return n;
end; $function$;

revoke execute on function public.refresh_meeting_kpi_goals(date) from public, anon;
revoke execute on function public.dd_seed_engagement(uuid) from public, anon;
revoke execute on function public.sales_bulk_add_assignees(uuid[], uuid[]) from public, anon;
