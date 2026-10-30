-- Database health, part 2: what the page reads and the one action it can take.
--
--   db_health_long_queries(min_s)   client queries running longer than min_s seconds
--   db_health_cancel_query(pid, s)  cancels one of those queries. Refuses any other
--                                   connection, so replication and system work can
--                                   never be cancelled from the page.
--   db_health_query_stats(n)        the n queries using the most time, with each one's
--                                   share of time and calls, and the median and 90th
--                                   percentile average across all queries. Reads
--                                   pg_stat_statements.
--
-- Roles: service role only. The page calls these after checking the signed in
-- admin's permission. anon and authenticated cannot execute them.

create or replace function public.db_health_long_queries(p_min_seconds numeric default 5)
returns table (pid integer, seconds numeric, query text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    a.pid,
    round(extract(epoch from (now() - a.query_start))::numeric, 1) as seconds,
    left(regexp_replace(a.query, '\s+', ' ', 'g'), 300) as query
  from pg_stat_activity a
  where a.datname = current_database()
    and a.pid <> pg_backend_pid()
    and a.state = 'active'
    and a.backend_type = 'client backend'
    and extract(epoch from (now() - a.query_start)) >= p_min_seconds
  order by a.query_start asc
  limit 20;
$$;

create or replace function public.db_health_cancel_query(p_pid integer, p_min_seconds numeric default 5)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  eligible boolean;
begin
  select exists (
    select 1 from pg_stat_activity a
    where a.pid = p_pid
      and a.pid <> pg_backend_pid()
      and a.datname = current_database()
      and a.state = 'active'
      and a.backend_type = 'client backend'
      and extract(epoch from (now() - a.query_start)) >= p_min_seconds
  ) into eligible;
  if not eligible then
    return false;
  end if;
  return pg_cancel_backend(p_pid);
end;
$$;

create or replace function public.db_health_query_stats(p_limit integer default 6)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, extensions
as $$
  with all_s as (
    select * from pg_stat_statements
  ), totals as (
    select sum(total_exec_time) as t, sum(calls) as c from all_s
  ), norms as (
    select
      count(*) as n,
      percentile_cont(0.5) within group (order by mean_exec_time) as median_mean_ms,
      percentile_cont(0.9) within group (order by mean_exec_time) as p90_mean_ms
    from all_s where calls >= 10
  ), top_s as (
    select
      left(regexp_replace(query, '\s+', ' ', 'g'), 160) as q,
      calls,
      round(mean_exec_time::numeric, 1) as mean_ms,
      round(max_exec_time::numeric, 0) as max_ms,
      round((100 * total_exec_time / nullif((select t from totals), 0))::numeric, 1) as time_pct,
      round((100 * calls::numeric / nullif((select c from totals), 0)), 3) as call_pct
    from all_s
    order by total_exec_time desc
    limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'norms', (select jsonb_build_object(
      'queries', n,
      'median_mean_ms', round(median_mean_ms::numeric, 1),
      'p90_mean_ms', round(p90_mean_ms::numeric, 1)) from norms),
    'top', coalesce((select jsonb_agg(to_jsonb(top_s)) from top_s), '[]'::jsonb)
  );
$$;

revoke all on function public.db_health_long_queries(numeric) from public, anon, authenticated;
revoke all on function public.db_health_cancel_query(integer, numeric) from public, anon, authenticated;
revoke all on function public.db_health_query_stats(integer) from public, anon, authenticated;
grant execute on function public.db_health_long_queries(numeric) to service_role;
grant execute on function public.db_health_cancel_query(integer, numeric) to service_role;
grant execute on function public.db_health_query_stats(integer) to service_role;
