-- Social Media Hub — Composer + Rules (build-spec §9). Archetype + brief on posts,
-- a single-row rules config, and the weekly publish slots.

alter table public.social_posts
  add column if not exists archetype text,   -- proof_case | teardown | named_ask
  add column if not exists brief     text;   -- "what happened" raw notes the draft was written from

-- One row of rules. v1 toggles are fixed in code, but persisted so the UI reflects
-- them and later versions can flip them. Rotation orders how slots pull archetypes.
create table if not exists public.social_settings (
  id                    integer primary key default 1 check (id = 1),
  approve_before_publish boolean not null default true,
  rewrite_per_account    boolean not null default true,
  skip_empty_slot        boolean not null default true,
  auto_publish           boolean not null default false,
  rotation               text[]  not null default array['proof_case','teardown','named_ask'],
  updated_at             timestamptz not null default now()
);
insert into public.social_settings (id) values (1) on conflict (id) do nothing;

-- Weekly publish slots (local time). The queue pulls approved variants into these.
create table if not exists public.social_slots (
  id         uuid primary key default gen_random_uuid(),
  weekday    integer not null check (weekday between 0 and 6), -- 0 = Sunday
  time_local text not null,                                    -- "HH:MM"
  created_at timestamptz not null default now()
);
