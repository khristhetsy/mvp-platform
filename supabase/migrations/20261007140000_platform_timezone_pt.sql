-- One platform time zone: Pacific time (America/Los_Angeles).
--
-- 1. Custom job schedules (Admin, System, Scheduled jobs) were kept as Paris
--    wall clock times. The app now reads them as Pacific time, so each one is
--    rewritten to the Pacific time of the same moment (Paris is 9 hours ahead
--    today), and every job keeps firing when it does now.
-- 2. The admin marketing notification settings saved in Paris time get the
--    same treatment: quiet hours and the digest keep the same moments, now
--    written in Pacific time.
-- 3. The IR Hub daily checklist resets at midnight Pacific instead of UTC.
-- 4. New rows default to Pacific time.
--
-- Rollback: rerun step 1 and 2 with the zones swapped; set run_reset_tz back to
-- 'UTC'; restore the old column defaults ('UTC', 'Europe/Paris').

-- Hours Paris is ahead of Pacific right now (9, or 8 in the odd weeks when
-- only one side has changed clocks).
create or replace function pg_temp.paris_minus_pt() returns int language sql as $$
  select (extract(epoch from (now() at time zone 'Europe/Paris') - (now() at time zone 'America/Los_Angeles')) / 3600)::int
$$;

-- "M H * * D" (H and D may be lists) in Paris → the same moment in Pacific.
-- Anything else (every N minutes, hourly) has no wall clock hour and is kept.
create or replace function pg_temp.cron_paris_to_pt(expr text) returns text language plpgsql as $$
declare
  p text[] := regexp_split_to_array(trim(expr), '\s+');
  shift int := pg_temp.paris_minus_pt();
  hours int[];
  out_hours int[] := '{}';
  day_shift int := 0;
  h int;
  nh int;
  dows text;
begin
  if array_length(p, 1) <> 5 or p[2] !~ '^[0-9]+(,[0-9]+)*$' or p[3] <> '*' or p[4] <> '*' then
    return expr;
  end if;
  hours := string_to_array(p[2], ',')::int[];
  foreach h in array hours loop
    nh := h - shift;
    if nh < 0 then
      -- Every hour must move to the previous day together, or the shape breaks.
      if day_shift = 0 and array_length(out_hours, 1) is not null then return expr; end if;
      day_shift := -1; nh := nh + 24;
    elsif day_shift = -1 then
      return expr;
    end if;
    out_hours := out_hours || nh;
  end loop;
  dows := p[5];
  if day_shift = -1 and dows <> '*' then
    select string_agg(((d::int + 6) % 7)::text, ',' order by (d::int + 6) % 7)
      into dows from unnest(string_to_array(p[5], ',')) d;
  end if;
  return p[1] || ' ' || array_to_string(out_hours, ',') || ' * * ' || dows;
end
$$;

update public.cron_schedule_overrides
set cron = (
      select string_agg(pg_temp.cron_paris_to_pt(e), ';')
      from unnest(string_to_array(cron, ';')) e
    ),
    updated_at = now()
where cron is not null and cron <> '';

update public.mkt_notification_settings
set quiet_start = quiet_start - make_interval(hours => pg_temp.paris_minus_pt()),
    quiet_end   = quiet_end   - make_interval(hours => pg_temp.paris_minus_pt()),
    digest_time = digest_time - make_interval(hours => pg_temp.paris_minus_pt()),
    timezone = 'America/Los_Angeles',
    updated_at = now()
where timezone = 'Europe/Paris';

update public.ops_hub_settings set run_reset_tz = 'America/Los_Angeles' where run_reset_tz in ('UTC', 'Europe/Paris');

alter table public.mkt_notification_settings alter column timezone set default 'America/Los_Angeles';
alter table public.calendar_events alter column timezone set default 'America/Los_Angeles';
alter table public.scheduling_availability alter column timezone set default 'America/Los_Angeles';
