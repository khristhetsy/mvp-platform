-- Account-activity notification routing: who hears about what, by stage.
--
-- Context. operational_activity_events already exists (0044) with categories,
-- severities, visibility and dedupe — but of the 115 founder and investor API
-- routes, six emit anything. This migration adds the two things that let the
-- rest of the work land: a stage stamp on each event, and a table saying which
-- staff member holds which stage.
--
-- Why stage and not category. The thirteen event_category values are how the
-- table is indexed; they are not how the work is divided. A company is worked
-- through four stages (initialize/qualify/deploy/optimize) and an investor
-- through five (prospect/outreach/engaged/diligence/committed), and the same
-- event means something different depending on where they are: a replaced pitch
-- deck in Preparation is progress, the same upload in Closing — after investors
-- have read the old one — is a problem. Stage is the axis that carries the
-- judgement, so it is the axis assignment and folding use.

-- ---------------------------------------------------------------------------
-- 1. Stamp each event with the stage it happened in
-- ---------------------------------------------------------------------------

alter table public.operational_activity_events
  add column if not exists activity_audience text,
  add column if not exists activity_stage    text;

comment on column public.operational_activity_events.activity_audience is
  'founder | investor | staff. Which side of the platform acted. Null on the pre-existing staff/system rows.';
comment on column public.operational_activity_events.activity_stage is
  'Founder: initialize|qualify|deploy|optimize. Investor: prospect|outreach|engaged|diligence|committed. Stamped by the emitter from the actor''s stage AT THE TIME, not looked up later — a company that has since advanced must not retro-date its old events into the new stage.';

alter table public.operational_activity_events
  drop constraint if exists operational_activity_events_audience_check;
alter table public.operational_activity_events
  add constraint operational_activity_events_audience_check check (
    activity_audience is null or activity_audience in ('founder', 'investor', 'staff')
  );

alter table public.operational_activity_events
  drop constraint if exists operational_activity_events_stage_check;
alter table public.operational_activity_events
  add constraint operational_activity_events_stage_check check (
    activity_stage is null or activity_stage in (
      'initialize', 'qualify', 'deploy', 'optimize',
      'prospect', 'outreach', 'engaged', 'diligence', 'committed'
    )
  );

-- The feed folds by stage inside a date window, and the date window is the
-- outer filter on every query it runs. 0044 already indexes created_at desc on
-- its own; this is the composite the folded feed actually uses.
create index if not exists operational_activity_events_stage_created_idx
  on public.operational_activity_events (activity_stage, created_at desc)
  where activity_stage is not null;

create index if not exists operational_activity_events_audience_created_idx
  on public.operational_activity_events (activity_audience, created_at desc)
  where activity_audience is not null;

-- ---------------------------------------------------------------------------
-- 2. Who holds each stage
-- ---------------------------------------------------------------------------

create table if not exists public.activity_stage_assignments (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('founder', 'investor')),
  stage text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- The lead is named in the alert and the escalation clock starts from them.
  -- Three people on a stage with no lead is three people each assuming one of
  -- the others has it.
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audience, stage, user_id)
);

comment on table public.activity_stage_assignments is
  'One row per (stage, staff member). Assignment is per stage rather than per event on purpose: 21 alert classes x 5 staff is a grid nobody maintains, 9 stages is one you can keep current.';

-- At most one lead per stage. A partial unique index rather than a trigger so
-- the database refuses a second lead outright.
create unique index if not exists activity_stage_assignments_one_lead_idx
  on public.activity_stage_assignments (audience, stage)
  where is_lead;

create index if not exists activity_stage_assignments_user_idx
  on public.activity_stage_assignments (user_id);

-- ---------------------------------------------------------------------------
-- 3. Per-stage escalation policy (one row per stage, not per person)
-- ---------------------------------------------------------------------------

create table if not exists public.activity_stage_policies (
  audience text not null check (audience in ('founder', 'investor')),
  stage text not null,
  -- Null = never escalate. 0 = escalate immediately (used when the lead is away).
  escalate_after_minutes integer check (escalate_after_minutes is null or escalate_after_minutes >= 0),
  escalate_to_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (audience, stage)
);

comment on table public.activity_stage_policies is
  'Escalation per stage: if nobody assigned opens a high/critical event within escalate_after_minutes, it goes to escalate_to_user_id. Null escalate_after_minutes means no escalation at all.';

-- ---------------------------------------------------------------------------
-- 4. Escalation bookkeeping — what has already been chased
-- ---------------------------------------------------------------------------

create table if not exists public.activity_event_escalations (
  event_id uuid primary key references public.operational_activity_events(id) on delete cascade,
  escalated_at timestamptz not null default now(),
  escalated_to uuid references public.profiles(id) on delete set null
);

comment on table public.activity_event_escalations is
  'Idempotence for the escalation sweep. Without it the cron re-escalates the same unopened event every run.';

-- ---------------------------------------------------------------------------
-- 5. Seen-state, so "nobody opened it" is a fact rather than an assumption
-- ---------------------------------------------------------------------------

create table if not exists public.activity_event_reads (
  event_id uuid not null references public.operational_activity_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists activity_event_reads_user_idx
  on public.activity_event_reads (user_id, read_at desc);

-- ---------------------------------------------------------------------------
-- 6. RLS — staff-only, same posture as 0044
-- ---------------------------------------------------------------------------

alter table public.activity_stage_assignments enable row level security;
alter table public.activity_stage_policies    enable row level security;
alter table public.activity_event_escalations enable row level security;
alter table public.activity_event_reads       enable row level security;

drop policy if exists activity_stage_assignments_staff_read on public.activity_stage_assignments;
create policy activity_stage_assignments_staff_read
  on public.activity_stage_assignments for select
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('admin', 'analyst')
  ));

drop policy if exists activity_stage_policies_staff_read on public.activity_stage_policies;
create policy activity_stage_policies_staff_read
  on public.activity_stage_policies for select
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('admin', 'analyst')
  ));

drop policy if exists activity_event_reads_own on public.activity_event_reads;
create policy activity_event_reads_own
  on public.activity_event_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists activity_event_escalations_staff_read on public.activity_event_escalations;
create policy activity_event_escalations_staff_read
  on public.activity_event_escalations for select
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role in ('admin', 'analyst')
  ));

-- Writes go through the service-role client in the API layer, which bypasses
-- RLS — same as every other staff-managed table here.

-- ---------------------------------------------------------------------------
-- 7. Seed: every stage falls to the super_admins until somebody is assigned
-- ---------------------------------------------------------------------------
--
-- A stage with nobody on it must not be silent. The application also falls back
-- to super_admins at read time, but seeding means the assignment screen opens
-- showing a real state rather than nine empty rows.

insert into public.activity_stage_policies (audience, stage, escalate_after_minutes, escalate_to_user_id)
select v.audience, v.stage, v.mins, (
  select p.id from public.profiles p
   where p.is_super_admin is true
   order by p.created_at asc
   limit 1
)
from (values
  ('founder',  'initialize', 240),
  ('founder',  'qualify',    240),
  ('founder',  'deploy',     240),
  ('founder',  'optimize',    60),
  ('investor', 'prospect',  1440),
  ('investor', 'outreach',  1440),
  ('investor', 'engaged',    240),
  ('investor', 'diligence',  240),
  ('investor', 'committed',   60)
) as v(audience, stage, mins)
on conflict (audience, stage) do nothing;
