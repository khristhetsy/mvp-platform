-- CEO Hub — read-only roll-up over Sales / Marketing / Operations, weekly-grain KPI
-- snapshots, AI Chief-of-Staff content, meetings + journals. iCapOS single-business
-- (ceo_business enum retained for later iCFO SPV). Admin-only; ceo_* tables gated by
-- the existing is_staff() helper, and accessed through service-role admin API routes.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ceo_business') then
    create type ceo_business as enum ('icapos', 'icfo_spv');
  end if;
end $$;

-- ========== KPI SYSTEM ==========
create table if not exists public.ceo_kpi_registry (
  key text primary key,
  dept text not null check (dept in ('sales','marketing','operations')),
  business ceo_business not null default 'icapos',
  label text not null,
  definition text not null default '',
  owner text not null,
  fmt text not null check (fmt in ('n','%','$','x','h','d')),
  direction text not null check (direction in ('up_good','down_good')),
  scales_with_period boolean not null default false,
  target numeric not null,
  red_line numeric not null,
  weight numeric not null default 1,
  benchmark text,
  source_view text not null,
  sort_order int not null,
  active boolean not null default true
);

create table if not exists public.ceo_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  kpi_key text not null references public.ceo_kpi_registry(key) on delete cascade,
  week_start date not null,
  value numeric not null,
  created_at timestamptz default now(),
  unique (kpi_key, week_start)
);

create table if not exists public.ceo_kpi_ai (
  id uuid primary key default gen_random_uuid(),
  kpi_key text not null references public.ceo_kpi_registry(key) on delete cascade,
  week_start date not null,
  diagnosis text not null,
  solutions jsonb not null,
  mentorship text not null,
  coach_prompt text not null,
  model text not null,
  created_at timestamptz default now(),
  unique (kpi_key, week_start)
);

-- ========== MEETINGS ==========
create table if not exists public.ceo_meetings (
  key text primary key,
  name text not null,
  dept text not null,
  cadence text not null default 'weekly',
  day_of_week int not null,
  time_local time not null,
  timezone text not null default 'America/Los_Angeles',
  duration_min int not null,
  attendees jsonb not null default '[]',
  agenda jsonb not null default '[]',
  workflow jsonb not null default '{}',
  gcal_event_id text,
  active boolean default true
);

create table if not exists public.ceo_meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_key text not null references public.ceo_meetings(key) on delete cascade,
  session_date date not null,
  gcal_instance_id text,
  attendance text,
  note text,
  decisions jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (meeting_key, session_date)
);

-- Journal tasks write through to the Admin Tasks board, tagged with their session.
alter table public.admin_tasks add column if not exists source_meeting_session_id uuid references public.ceo_meeting_sessions(id) on delete set null;

-- ========== BRIEFS / RECS / GOALS / PREFS ==========
create table if not exists public.ceo_briefs (
  id uuid primary key default gen_random_uuid(),
  business ceo_business not null default 'icapos',
  brief_date date not null,
  headline text not null default '',
  sections jsonb not null default '[]',
  model text,
  created_at timestamptz default now(),
  unique (business, brief_date)
);

create table if not exists public.ceo_recommendations (
  id uuid primary key default gen_random_uuid(),
  business ceo_business not null default 'icapos',
  title text not null,
  detail text not null default '',
  hub text,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'open' check (status in ('open','accepted','dismissed','done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ceo_goals (
  id uuid primary key default gen_random_uuid(),
  business ceo_business not null default 'icapos',
  title text not null,
  metric text,
  target numeric,
  current numeric default 0,
  period text,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ceo_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_daily boolean not null default false,
  email_weekly boolean not null default true,
  updated_at timestamptz default now()
);

create table if not exists public.ceo_user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business ceo_business not null default 'icapos',
  prefs jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- ========== RLS (reuse is_staff() — admin/analyst) ==========
alter table public.ceo_kpi_registry     enable row level security;
alter table public.ceo_kpi_snapshots    enable row level security;
alter table public.ceo_kpi_ai           enable row level security;
alter table public.ceo_meetings         enable row level security;
alter table public.ceo_meeting_sessions enable row level security;
alter table public.ceo_briefs           enable row level security;
alter table public.ceo_recommendations  enable row level security;
alter table public.ceo_goals            enable row level security;
alter table public.ceo_notification_prefs enable row level security;
alter table public.ceo_user_prefs       enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'ceo_kpi_registry','ceo_kpi_snapshots','ceo_kpi_ai','ceo_meetings','ceo_meeting_sessions',
    'ceo_briefs','ceo_recommendations','ceo_goals','ceo_notification_prefs','ceo_user_prefs'
  ] loop
    execute format('drop policy if exists %I_staff on public.%I', tbl, tbl);
    execute format('create policy %I_staff on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', tbl, tbl);
  end loop;
end $$;
