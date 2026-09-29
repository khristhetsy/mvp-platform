-- ============================================================================
-- PENDING MIGRATIONS — run this whole file in the Supabase SQL editor.
--
-- Paste the CONTENTS of this file, not its name. All four migrations are here
-- in numeric order, separated by banners. Every statement is idempotent
-- (`if not exists`, `drop ... if exists` before `add`), so running the file a
-- second time is safe if you are unsure which ones already went through.
--
--   20260921001  discontinue the free founder plan, grandfather existing ones
--   20260921002  traction fields captured during founder onboarding
--   20260921003  account-activity stages, assignment and escalation
--   20260921004  meeting attribution on the booking itself
-- ============================================================================



-- ============================================================================
-- 20260921001_grandfather_free_plan
-- ============================================================================

-- Discontinue the free founder plan for new signups; keep existing accounts on it.
--
-- Until now "Free (grandfathered)" was only a display label — no flag, no date
-- check. Every free account claimed to be grandfathered, including ones created
-- after the $49 Basic plan launched. This makes the status a real, stored fact
-- so it can be read, granted and revoked rather than inferred on every read.
--
-- Cutoff: 2026-09-16, the day founder_basic shipped at $49 (commit 5786f92).
-- Accounts created between then and today are ALSO grandfathered: they were
-- granted free because a revert (b7ae05b) had put the free tier back, which was
-- our error, not theirs. Revoke individually from admin billing if needed.

alter table public.subscriptions
  add column if not exists is_grandfathered boolean not null default false;

comment on column public.subscriptions.is_grandfathered is
  'True when this account keeps free access after the plan was discontinued. Set once by backfill; grantable/revocable by staff. Never inferred from a date at read time.';

-- Backfill: every founder currently on a free plan keeps it.
update public.subscriptions
   set is_grandfathered = true
 where plan_type in ('founder_free', 'founder_trial')
   and is_grandfathered = false;

-- Finding free accounts is a routine admin filter; keep it cheap.
create index if not exists subscriptions_grandfathered_idx
  on public.subscriptions (is_grandfathered)
  where is_grandfathered = true;

-- The original CHECK predates founder_free / founder_managed_ir / investor_pro /
-- investor_premium, so rows using them were only ever insertable because the
-- constraint was dropped or never enforced. Restate it against the real plan set.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;

alter table public.subscriptions
  add constraint subscriptions_plan_type_check check (
    plan_type in (
      'founder_free',
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'founder_managed_ir',
      'investor_free',
      'investor_pro',
      'investor_premium',
      'admin_internal'
    )
  );

-- New founders land here until checkout completes, so 'pending_payment' has to
-- be a legal status.
alter table public.subscriptions
  drop constraint if exists subscriptions_subscription_status_check;

alter table public.subscriptions
  add constraint subscriptions_subscription_status_check check (
    subscription_status in (
      'trialing', 'active', 'expired', 'canceled', 'free', 'internal', 'pending_payment'
    )
  );


-- ============================================================================
-- 20260921002_company_traction_fields
-- ============================================================================

-- Traction fields the founder can now answer during onboarding (step 8).
--
-- These four were the only ones on the admin Founder Profile panel with no
-- source anywhere: the founder was never asked, so the panel showed a dash and
-- the CRR engine's Traction and Revenue factors scored zero for want of
-- evidence rather than weak performance.
--
-- Stored as text, not numeric, on purpose: founders write "$240k", "~20,000/mo"
-- or "pre-revenue", and coercing that to a number at write time loses the
-- nuance and rejects honest answers. Matching reads bands, not exact figures.

alter table public.companies
  add column if not exists annual_revenue_size text,
  add column if not exists arr                text,
  add column if not exists mrr                text,
  add column if not exists key_highlights     text;

comment on column public.companies.annual_revenue_size is
  'Last-12-months revenue BAND (Pre-revenue, Under $100k, $100k - $500k, ...). Investor-facing. Distinct from revenue_stage, which describes the company''s phase rather than its revenue.';
comment on column public.companies.arr is
  'Annual recurring revenue, as the founder wrote it. Optional — blank means no recurring revenue, not unknown.';
comment on column public.companies.mrr is
  'Monthly recurring revenue, as the founder wrote it. Optional.';
comment on column public.companies.key_highlights is
  'Up to five one-line highlights, newline-separated. Investor-facing: these become the bullet list on the one-pager.';

-- Revenue band is a filter on the marketplace and in matching.
create index if not exists companies_annual_revenue_size_idx
  on public.companies (annual_revenue_size)
  where annual_revenue_size is not null;


-- ============================================================================
-- 20260921003_activity_stage_assignments
-- ============================================================================

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


-- ============================================================================
-- 20260921004_booking_source_attribution
-- ============================================================================

-- Attribute a meeting to the campaign that produced it.
--
-- The problem this fixes. A booking was only ever attributable if the person
-- walked the /fit funnel first, in the same browser, before booking: the book
-- route reads an `fs_session` cookie and, only if it finds one, calls
-- handoffFitSession — the single piece of code anywhere that writes a campaign
-- tag onto a contact. Every other route to the scheduler recorded nothing, and
-- `scheduling_bookings` had no source column to fall back on, so the Social Hub
-- reported "Meetings 0" while meetings were plainly happening.
--
-- The fix is to make the BOOKING the attributed record rather than inferring
-- attribution through a contact that, for a cold lead, does not exist.
--
-- The /fit path is deliberately unchanged. It is the highest-confidence signal
-- available and it already works; everything here is additive capture for the
-- paths that currently record nothing.

alter table public.scheduling_bookings
  add column if not exists source_tag        text,
  add column if not exists source_confidence text,
  add column if not exists source_set_by     uuid references public.profiles(id) on delete set null,
  add column if not exists source_set_at     timestamptz;

comment on column public.scheduling_bookings.source_tag is
  'Campaign source_tag this meeting is attributed to. Null means unattributed — which is shown as such, never folded into a zero.';
comment on column public.scheduling_bookings.source_confidence is
  'HOW the tag was obtained, because the answers are not equally trustworthy. fit = walked the funnel; link = clicked a tagged scheduler link; cookie = arrived from a tagged link earlier in the window; self_reported = told us in the booking form; manual = a staff member set it after the meeting.';
comment on column public.scheduling_bookings.source_set_by is
  'Only set for manual. A human overriding a machine is recorded as such.';

-- The ladder, in the order the resolver applies it. Storing the confidence
-- rather than just the tag is what lets the funnel show "7 tagged, 2
-- self-reported" instead of pretending the two are the same evidence.
alter table public.scheduling_bookings
  drop constraint if exists scheduling_bookings_source_confidence_check;
alter table public.scheduling_bookings
  add constraint scheduling_bookings_source_confidence_check check (
    source_confidence is null or source_confidence in
      ('fit', 'link', 'cookie', 'self_reported', 'manual')
  );

-- A tag without a confidence (or the reverse) would make the funnel's
-- breakdown lie, so the database refuses the half-set state outright.
alter table public.scheduling_bookings
  drop constraint if exists scheduling_bookings_source_pair_check;
alter table public.scheduling_bookings
  add constraint scheduling_bookings_source_pair_check check (
    (source_tag is null and source_confidence is null)
    or (source_tag is not null and source_confidence is not null)
  );

-- The funnel rolls meetings up by tag inside a date window, which is now one
-- indexed read instead of the contacts-then-emails-then-bookings walk it did
-- before.
create index if not exists scheduling_bookings_source_created_idx
  on public.scheduling_bookings (source_tag, created_at desc)
  where source_tag is not null;

-- Finding the unattributed ones is a routine staff task (that is the queue for
-- setting a source by hand), so keep it cheap too.
create index if not exists scheduling_bookings_unattributed_idx
  on public.scheduling_bookings (created_at desc)
  where source_tag is null;

-- ---------------------------------------------------------------------------
-- Backfill: the meetings that /fit DID attribute
-- ---------------------------------------------------------------------------
--
-- Past bookings whose linked contact carries a lead_source matching a live
-- campaign tag were already being counted through the old contact join. Copying
-- that onto the booking keeps history intact when the funnel switches over to
-- reading the column — without it, every historical meeting would drop to zero
-- the moment this ships.
--
-- Confidence 'fit' because handoffFitSession was the only writer of a
-- tag-shaped lead_source.

update public.scheduling_bookings b
   set source_tag = c.overrides->>'lead_source',
       source_confidence = 'fit'
  from public.crm_contacts c
 where b.contact_crm_id = c.id
   and b.source_tag is null
   and c.overrides->>'lead_source' is not null
   and exists (
     select 1 from public.social_campaigns sc
      where sc.source_tag = c.overrides->>'lead_source'
   );

