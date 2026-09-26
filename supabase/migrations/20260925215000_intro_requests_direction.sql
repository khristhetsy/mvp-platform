-- Gated introductions: these columns already exist in production (applied
-- directly on 2026-09-25) but were never committed. Captured here so the repo's
-- schema matches the database. Idempotent: a no-op where they already exist.
alter table public.intro_requests
  add column if not exists direction text not null default 'investor_to_founder',
  add column if not exists requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists pipeline_investor_id uuid references public.pipeline_investors(id) on delete set null;

alter table public.intro_requests alter column investor_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'intro_requests_direction_check') then
    alter table public.intro_requests
      add constraint intro_requests_direction_check
      check (direction = any (array['investor_to_founder', 'founder_to_investor']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'intro_requests_target_check') then
    alter table public.intro_requests
      add constraint intro_requests_target_check
      check (investor_id is not null or pipeline_investor_id is not null);
  end if;
end $$;
