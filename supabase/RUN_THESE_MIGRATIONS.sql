-- =====================================================================
-- iCapOS — pending migrations (run in order, one session).
-- All statements are idempotent: safe to run even if already applied.
-- Paste this whole file into the Supabase SQL editor and Run.
-- =====================================================================

-- 1) Marketing lists: archive flag ------------------------------------
alter table public.marketing_lists
  add column if not exists archived boolean not null default false;
create index if not exists idx_marketing_lists_archived on public.marketing_lists (archived);

-- 2) Campaigns: per-campaign content overrides (Preview & edit) --------
alter table public.marketing_campaigns
  add column if not exists subject_override text,
  add column if not exists body_override text;

-- 3) Campaigns: archive flag ------------------------------------------
alter table public.marketing_campaigns
  add column if not exists archived boolean not null default false;

-- 4) Operations tasks (assign / edit / save / archive) ----------------
create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  entity_type text not null,
  entity_id text not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  created_by uuid references public.profiles(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ops_tasks_entity on public.ops_tasks (entity_type, entity_id) where archived = false;
alter table public.ops_tasks enable row level security;

-- 5) Operations Hub settings (escalation SLAs + default manager) -------
create table if not exists public.ops_settings (
  id text primary key default 'default',
  onboarding_sla_days int not null default 7,
  diligence_sla_days int not null default 3,
  default_manager_id uuid references public.profiles(id) on delete set null,
  email_escalations boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.ops_settings (id) values ('default') on conflict (id) do nothing;
alter table public.ops_settings enable row level security;

-- 6) Sales Hub — pipelines, stages, opportunities (standalone) --------
create table if not exists public.sales_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.sales_pipelines(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_won boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_stages_pipeline on public.sales_stages (pipeline_id, sort_order);

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_profile_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  contact_name text,
  contact_email text,
  pipeline_id uuid references public.sales_pipelines(id) on delete set null,
  stage_id uuid references public.sales_stages(id) on delete set null,
  value_cents bigint,
  status text not null default 'open' check (status in ('open','won','lost','archived')),
  odoo_lead_id text,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_opps_stage on public.sales_opportunities (stage_id) where status = 'open';
create index if not exists idx_sales_opps_status on public.sales_opportunities (status);

alter table public.sales_pipelines enable row level security;
alter table public.sales_stages enable row level security;
alter table public.sales_opportunities enable row level security;

do $$
declare pid uuid;
begin
  if not exists (select 1 from public.sales_pipelines where is_default) then
    insert into public.sales_pipelines (name, is_default) values ('Founder sales', true) returning id into pid;
    insert into public.sales_stages (pipeline_id, name, sort_order, is_won) values
      (pid, 'New lead', 0, false),
      (pid, 'Qualified', 1, false),
      (pid, 'Demo', 2, false),
      (pid, 'Proposal', 3, false),
      (pid, 'Won', 4, true);
  end if;
end $$;

-- 7) Sales Hub settings — task types + reminder preferences -----------
create table if not exists public.sales_settings (
  id text primary key default 'default',
  task_types text[] not null default array['Call','Email','Demo','Follow-up','Proposal'],
  remind_task_due boolean not null default true,
  remind_stalled boolean not null default true,
  stalled_days int not null default 14,
  updated_at timestamptz not null default now()
);
insert into public.sales_settings (id) values ('default') on conflict (id) do nothing;
alter table public.sales_settings enable row level security;

-- 8) Sales Hub enrichment — richer opportunities + tasks + extra settings.
alter table public.sales_opportunities add column if not exists probability int;
alter table public.sales_opportunities add column if not exists expected_close date;
alter table public.sales_opportunities add column if not exists priority int not null default 0;
alter table public.sales_opportunities add column if not exists tags text[] not null default array[]::text[];
alter table public.sales_opportunities add column if not exists source text;
alter table public.sales_opportunities add column if not exists lead_status text;
alter table public.sales_opportunities add column if not exists billing text not null default 'yearly';
alter table public.sales_opportunities add column if not exists contact_crm_id text;
alter table public.sales_opportunities add column if not exists last_activity_at timestamptz;

create table if not exists public.sales_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'Call',
  summary text,
  due_date date,
  status text not null default 'open' check (status in ('open','done','snoozed')),
  assignee_id uuid references public.profiles(id) on delete set null,
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  contact_crm_id text,
  contact_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists idx_sales_tasks_status on public.sales_tasks (status, due_date);
create index if not exists idx_sales_tasks_opp on public.sales_tasks (opportunity_id);
create index if not exists idx_sales_tasks_assignee on public.sales_tasks (assignee_id) where status = 'open';
alter table public.sales_tasks enable row level security;

alter table public.sales_settings add column if not exists default_assignee_id uuid references public.profiles(id) on delete set null;
alter table public.sales_settings add column if not exists remind_close_passed boolean not null default false;

-- 9) Sales activity log + rename Demo stage to Meeting.
create table if not exists public.sales_activity_log (
  id uuid primary key default gen_random_uuid(),
  contact_crm_id text,
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  summary text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_activity_contact on public.sales_activity_log (contact_crm_id, created_at desc);
create index if not exists idx_sales_activity_opp on public.sales_activity_log (opportunity_id, created_at desc);
alter table public.sales_activity_log enable row level security;

update public.sales_stages set name = 'Meeting' where name = 'Demo';

-- 10) Founder pitch decks (one row per company).
create table if not exists public.pitch_decks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  slides jsonb not null default '{}'::jsonb,
  theme text not null default 'navy',
  status text not null default 'draft' check (status in ('draft','finalized')),
  share_token text unique,
  ai_assisted boolean not null default false,
  generated_at timestamptz,
  finalized_at timestamptz,
  last_edited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pitch_decks_token on public.pitch_decks (share_token) where share_token is not null;
alter table public.pitch_decks enable row level security;

-- 11) Business plan AI charts (structured allocation + market figures).
alter table public.business_plans add column if not exists charts jsonb not null default '{}'::jsonb;

-- 12) CRM contact facets — derived Founder/Investor/Advisor/Other type + country for the grouped admin list.
alter table public.crm_contacts
  add column if not exists contact_type text generated always as (
    case
      when module = 'founder' then 'founder'
      when module = 'investor' then 'investor'
      when lower(coalesce(plan, '')) like '%advis%'
        or lower(coalesce(raw -> '__profile' ->> 'membership', '')) like '%advis%' then 'advisor'
      when lower(coalesce(raw -> '__profile' ->> 'membership', '')) like '%entrepreneur%'
        or lower(coalesce(raw -> '__profile' ->> 'membership', '')) like '%founder%' then 'founder'
      when lower(coalesce(raw -> '__profile' ->> 'membership', '')) like '%investor%' then 'investor'
      else 'other'
    end
  ) stored;

alter table public.crm_contacts
  add column if not exists country text generated always as (
    nullif(raw -> 'country_id' ->> 1, '')
  ) stored;

create index if not exists idx_crm_contacts_contact_type on public.crm_contacts (contact_type);
create index if not exists idx_crm_contacts_country on public.crm_contacts (country);

create or replace view public.crm_country_facets as
  select source, contact_type, country, count(*)::int as n
  from public.crm_contacts
  where country is not null and country <> ''
  group by source, contact_type, country;

-- 13) CRM contact "Created on" (Odoo create_date) — for the admin list display + sorting.
alter table public.crm_contacts
  add column if not exists created_on text generated always as (raw ->> 'create_date') stored;
create index if not exists idx_crm_contacts_created_on on public.crm_contacts (created_on);

-- 14) CRM contact profile edit overrides — persist user edits to Odoo-sourced fields.
alter table public.crm_contacts
  add column if not exists overrides jsonb not null default '{}'::jsonb;

-- Done. Verify all Sales tables exist with:
--   select table_name from information_schema.tables
--   where table_schema='public' and table_name like 'sales_%';
-- Expect 5 rows: sales_pipelines, sales_stages, sales_opportunities, sales_settings, sales_tasks.


-- 15) Operations Hub v2 — daily checks, hub settings, advisory actions.
-- Operations Hub v2 — tabbed hub additions on top of the v1 playbook console.
-- Prior playbook_* tables stand. Adds: per-admin daily checks, hub settings,
-- and advisory dismiss/snooze state. Admin-gated via profiles.role like the rest.

-- 1) Per-admin, per-day "today's run" check-off. Reset is implicit (read today only).
create table if not exists public.playbook_daily_checks (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  surface_id  uuid not null references public.playbook_module(id) on delete cascade,
  checked_on  date not null,
  checked_at  timestamptz not null default now(),
  unique (admin_id, surface_id, checked_on)
);
create index if not exists idx_playbook_daily_checks_admin_day on public.playbook_daily_checks (admin_id, checked_on);

-- 2) Single-row hub settings (hub-wide).
create table if not exists public.ops_hub_settings (
  id                       int primary key default 1 check (id = 1),
  drift_detection          boolean not null default true,
  drift_auto_add           boolean not null default false,
  advisory_enabled         boolean not null default true,
  run_reset_tz             text not null default 'Europe/Paris',
  escalation_past_due_days int not null default 21,
  playbook_edit_scope      text not null default 'all_admins' check (playbook_edit_scope in ('all_admins','owner_only')),
  updated_at               timestamptz not null default now()
);
insert into public.ops_hub_settings (id) values (1) on conflict (id) do nothing;

-- 3) Advisory dismiss/snooze state (suggestions themselves are computed, not stored).
create table if not exists public.ops_advisory_actions (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references auth.users(id) on delete cascade,
  suggestion_key text not null,
  action         text not null check (action in ('dismissed','snoozed')),
  snooze_until   timestamptz,
  created_at     timestamptz not null default now(),
  unique (admin_id, suggestion_key)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.playbook_daily_checks enable row level security;
alter table public.ops_hub_settings      enable row level security;
alter table public.ops_advisory_actions  enable row level security;

-- Daily checks: an admin/analyst manages only their own rows.
create policy pb_daily_own on public.playbook_daily_checks for all to authenticated
  using (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

-- Hub settings: admin/analyst read; admin write (finer scope enforced in the API).
create policy ops_hub_settings_read on public.ops_hub_settings for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
create policy ops_hub_settings_write on public.ops_hub_settings for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Advisory actions: an admin manages only their own rows.
create policy ops_advisory_own on public.ops_advisory_actions for all to authenticated
  using (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
