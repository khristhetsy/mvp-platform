-- Performance fix (audit H5): server-side aggregation for learning analytics that
-- previously loaded ENTIRE progress tables into Node and grouped in JS
-- (getLearningAtRiskFounders / getLeaderboard / getGlobalModuleEngagementCounts).
-- These are called via the service-role client (bypasses RLS); `security definer`
-- keeps the grouping server-side. Read-only, no data changes.

-- Per-company most-recent learning activity across the three progress tables.
create or replace function public.learning_company_last_activity()
returns table(company_id uuid, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select company_id, max(ts) as last_activity
  from (
    select company_id, last_viewed_at as ts from public.learning_progress        where last_viewed_at is not null
    union all
    select company_id, last_viewed_at       from public.founder_lesson_progress  where last_viewed_at is not null
    union all
    select company_id, completed_at         from public.founder_lesson_progress  where completed_at   is not null
    union all
    select company_id, last_viewed_at       from public.learning_course_progress where last_viewed_at is not null
  ) t
  group by company_id;
$$;

-- Per-company leaderboard stats: completed modules, summed percent, badge count.
create or replace function public.learning_leaderboard_stats()
returns table(company_id uuid, modules_completed bigint, sum_percent bigint, badges bigint)
language sql stable security definer set search_path = public as $$
  select p.company_id,
         count(*) filter (where p.status = 'completed')                                     as modules_completed,
         coalesce(sum(p.percent_complete), 0)::bigint                                        as sum_percent,
         (select count(*) from public.learning_user_badges b where b.company_id = p.company_id) as badges
  from public.learning_progress p
  group by p.company_id;
$$;

-- Global engagement per module (anything past 'not_started').
create or replace function public.learning_module_engagement_counts()
returns table(module_id uuid, cnt bigint)
language sql stable security definer set search_path = public as $$
  select module_id, count(*) as cnt
  from public.learning_progress
  where status <> 'not_started'
  group by module_id;
$$;

grant execute on function public.learning_company_last_activity()       to service_role;
grant execute on function public.learning_leaderboard_stats()           to service_role;
grant execute on function public.learning_module_engagement_counts()    to service_role;
