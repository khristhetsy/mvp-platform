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

-- 16) Operations Hub drift ignore list.
-- Operations Hub: let operators permanently dismiss menu-drift surfaces they don't
-- want in the playbook. Seeds the CRM / SPV / Partner surfaces the operator excluded.
alter table public.ops_hub_settings add column if not exists drift_ignored text[] not null default '{}';

update public.ops_hub_settings
  set drift_ignored = array[
    '/admin/crm/founders',
    '/admin/crm/investors',
    '/admin/crm/unclassified',
    '/admin/crm/connectors',
    '/admin/spvs',
    '/admin/partner-scores'
  ]
  where id = 1 and (drift_ignored is null or cardinality(drift_ignored) = 0);

-- 17) Hide Marketing Hub from Operations Hub.
-- Hide the Marketing Hub surface from the Operations Hub (reversible; content preserved).
-- Additive so it won't disturb any surfaces already hidden via the UI.
update public.ops_hub_settings
  set drift_ignored = array_append(drift_ignored, '/admin/marketing')
  where id = 1 and not ('/admin/marketing' = any(coalesce(drift_ignored, '{}')));

-- 18) Departments — schema, RLS, audit, seed.
-- Departments — department-scoped access for internal users, additive on top of the
-- existing role/permission system. Founder/Investor experiences are untouched.
-- Fail-closed: absence of a grant = denied for non-admin departments. Admin bypasses
-- department filtering in code (never modeled as "all toggles on").

-- ── Tables ────────────────────────────────────────────────────────────────────
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  hub_key text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  hub_key text not null,
  path text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.department_features (
  department_id uuid not null references public.departments(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (department_id, feature_id)
);

create table if not exists public.department_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

create table if not exists public.department_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  department_id uuid,
  feature_id uuid,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_dept_audit_created on public.department_audit_log (created_at desc);

-- ── Helpers (reused across policies + RPC) ──────────────────────────────────────
create or replace function public.is_internal_user(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','analyst'));
$$;

-- Platform admin (legacy) OR member of an is_admin department → may administer departments.
create or replace function public.can_admin_departments(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin')
      or exists (select 1 from public.department_members dm join public.departments d on d.id = dm.department_id where dm.user_id = uid and d.is_admin);
$$;

-- ── Seed: 4 departments + approved feature registry + starter grants ────────────
insert into public.departments (key, name, hub_key, is_admin) values
  ('admin',              'Admin',              'general_admin',      true),
  ('investor_relations', 'Investor Relations', 'investor_relations', false),
  ('marketing',          'Marketing',          'marketing',          false),
  ('sales',              'Sales',              'sales',              false)
on conflict (key) do nothing;

insert into public.features (key, label, hub_key, path, sort_order) values
  -- general_admin
  ('admin_dashboard',    'Dashboard',           'general_admin', '/admin',                  10),
  ('operations_hub',     'Operations Hub',      'general_admin', '/admin/playbook',         20),
  ('companies',          'Companies',           'general_admin', '/admin/companies',        30),
  ('investors_directory','Investors',           'general_admin', '/admin/investors',        40),
  ('action_center',      'Action Center',       'general_admin', '/admin/actions',          50),
  ('tasks',              'Tasks',               'general_admin', '/admin/tasks',            60),
  ('portfolio',          'Portfolio',           'general_admin', '/admin/portfolio',        70),
  ('readiness',          'Readiness Scores',    'general_admin', '/admin/readiness',        80),
  ('diligence_tracker',  'Diligence Tracker',   'general_admin', '/admin/data-room',        90),
  ('diligence_review',   'Diligence Review',    'general_admin', '/admin/diligence',       100),
  ('learning',           'Learning',            'general_admin', '/admin/learning',        110),
  ('events',             'Events',              'general_admin', '/admin/events',          120),
  ('operations_manual',  'Operations Manual',   'general_admin', '/admin/manual',          130),
  ('analytics',          'Analytics',           'general_admin', '/admin/analytics',       140),
  ('reports',            'Reports',             'general_admin', '/admin/reports',          150),
  ('insights',           'Insights',            'general_admin', '/admin/insights',        160),
  ('funnels',            'Activation Funnels',  'general_admin', '/admin/funnels',         170),
  ('compliance',         'Compliance',          'general_admin', '/admin/compliance',      180),
  ('audit',              'Audit',               'general_admin', '/admin/audit',           190),
  ('voice',              'Voice',               'general_admin', '/admin/voice',           200),
  ('inbox',              'Inbox',               'general_admin', '/admin/inbox',           210),
  ('calendar',           'Calendar',            'general_admin', '/admin/calendar',        220),
  ('signatures',         'E-Signatures',        'general_admin', '/admin/signatures',      230),
  ('user_management',    'User Management',     'general_admin', '/admin/users/manage',    240),
  ('user_permissions',   'User Permissions',    'general_admin', '/admin/users/permissions',250),
  ('feature_controls',   'Feature Controls',    'general_admin', '/admin/feature-controls',260),
  ('billing',            'Billing',             'general_admin', '/admin/billing',         270),
  ('system',             'System',              'general_admin', '/admin/integrations',    280),
  ('profile',            'My Profile',          'general_admin', '/admin/profile',         290),
  -- investor_relations
  ('ir_crm',             'IR CRM',              'investor_relations', '/admin/crm',            10),
  ('founder_crm',        'Founder CRM',         'investor_relations', '/admin/crm/founders',   20),
  ('investor_crm',       'Investor CRM',        'investor_relations', '/admin/crm/investors',  30),
  ('crm_unclassified',   'Unclassified',        'investor_relations', '/admin/crm/unclassified',40),
  ('contact_sync',       'Contact Sync',        'investor_relations', '/admin/crm/connectors', 50),
  ('intro_requests',     'Intro Requests',      'investor_relations', '/admin/intro-requests', 60),
  ('deal_rooms',         'Deal Rooms',          'investor_relations', '/admin/deal-rooms',     70),
  ('spvs',               'SPVs',                'investor_relations', '/admin/spvs',           80),
  ('matching',           'Matching',            'investor_relations', '/admin/matching',       90),
  ('partner_scores',     'Partner Scores',      'investor_relations', '/admin/partner-scores',100),
  -- marketing
  ('marketing_hub',      'Marketing Hub',       'marketing', '/admin/marketing',            10),
  -- sales
  ('sales_hub',          'Sales Hub',           'sales', '/admin/sales',                     10)
on conflict (key) do nothing;

-- Starter grants: each non-admin department gets its own hub's features enabled.
-- Admin department needs no rows — it bypasses filtering in code.
insert into public.department_features (department_id, feature_id, enabled)
select d.id, f.id, true
from public.departments d
join public.features f on f.hub_key = d.hub_key
where d.is_admin = false
on conflict (department_id, feature_id) do nothing;

-- ── Audit triggers (created AFTER seed so seeding doesn't log) ───────────────────
create or replace function public.log_department_features_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    insert into public.department_audit_log(actor_id, action, department_id, feature_id, detail)
      values (auth.uid(), 'grant_disabled', OLD.department_id, OLD.feature_id, jsonb_build_object('via','delete'));
    return OLD;
  else
    insert into public.department_audit_log(actor_id, action, department_id, feature_id, detail)
      values (auth.uid(), case when NEW.enabled then 'grant_enabled' else 'grant_disabled' end, NEW.department_id, NEW.feature_id, jsonb_build_object('enabled', NEW.enabled));
    return NEW;
  end if;
end $$;

drop trigger if exists trg_department_features_audit on public.department_features;
create trigger trg_department_features_audit
  after insert or update or delete on public.department_features
  for each row execute function public.log_department_features_change();

create or replace function public.log_department_members_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    insert into public.department_audit_log(actor_id, action, department_id, target_user_id)
      values (auth.uid(), 'member_removed', OLD.department_id, OLD.user_id);
    return OLD;
  else
    insert into public.department_audit_log(actor_id, action, department_id, target_user_id)
      values (auth.uid(), 'member_added', NEW.department_id, NEW.user_id);
    return NEW;
  end if;
end $$;

drop trigger if exists trg_department_members_audit on public.department_members;
create trigger trg_department_members_audit
  after insert or delete on public.department_members
  for each row execute function public.log_department_members_change();

-- ── RLS: internal users read; only department admins write ──────────────────────
alter table public.departments         enable row level security;
alter table public.features            enable row level security;
alter table public.department_features enable row level security;
alter table public.department_members  enable row level security;
alter table public.department_audit_log enable row level security;

drop policy if exists departments_read on public.departments;
drop policy if exists departments_write on public.departments;
create policy departments_read on public.departments for select to authenticated using (public.is_internal_user(auth.uid()));
create policy departments_write on public.departments for all to authenticated using (public.can_admin_departments(auth.uid())) with check (public.can_admin_departments(auth.uid()));

drop policy if exists features_read on public.features;
drop policy if exists features_write on public.features;
create policy features_read on public.features for select to authenticated using (public.is_internal_user(auth.uid()));
create policy features_write on public.features for all to authenticated using (public.can_admin_departments(auth.uid())) with check (public.can_admin_departments(auth.uid()));

drop policy if exists department_features_read on public.department_features;
drop policy if exists department_features_write on public.department_features;
create policy department_features_read on public.department_features for select to authenticated using (public.is_internal_user(auth.uid()));
create policy department_features_write on public.department_features for all to authenticated using (public.can_admin_departments(auth.uid())) with check (public.can_admin_departments(auth.uid()));

drop policy if exists department_members_read on public.department_members;
drop policy if exists department_members_write on public.department_members;
create policy department_members_read on public.department_members for select to authenticated using (public.is_internal_user(auth.uid()));
create policy department_members_write on public.department_members for all to authenticated using (public.can_admin_departments(auth.uid())) with check (public.can_admin_departments(auth.uid()));

drop policy if exists department_audit_read on public.department_audit_log;
drop policy if exists department_audit_write on public.department_audit_log;
create policy department_audit_read on public.department_audit_log for select to authenticated using (public.is_internal_user(auth.uid()));
create policy department_audit_write on public.department_audit_log for all to authenticated using (public.can_admin_departments(auth.uid())) with check (public.can_admin_departments(auth.uid()));

-- 19) Departments — access RPCs.
-- Departments — access RPCs. One call resolves a user's effective feature set.
-- Admin bypass (is_admin department OR legacy platform-admin role) → all active
-- features. Otherwise → union of enabled grants across the user's departments.

create or replace function public.get_user_features(p_user_id uuid)
returns table (feature_key text, label text, hub_key text, path text, sort_order int)
language sql stable security definer set search_path = public as $$
  -- Admin bypass: every active feature.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  where f.is_active and public.can_admin_departments(p_user_id)
  union
  -- Non-admin: distinct enabled grants across all of the user's active departments.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  join public.department_features df on df.feature_id = f.id and df.enabled
  join public.department_members dm on dm.department_id = df.department_id and dm.user_id = p_user_id
  join public.departments d on d.id = df.department_id and d.is_active
  where f.is_active;
$$;

create or replace function public.get_user_hubs(p_user_id uuid)
returns table (hub_key text)
language sql stable security definer set search_path = public as $$
  select distinct hub_key from public.get_user_features(p_user_id);
$$;

grant execute on function public.get_user_features(uuid) to authenticated;
grant execute on function public.get_user_hubs(uuid) to authenticated;

-- 20) Departments — scope by admin DEPARTMENT (not role) in the access RPC.
-- Scope by department, not role: get_user_features bypasses ONLY for members of an
-- is_admin department. (can_admin_departments still lets legacy platform admins write
-- to the department tables via RLS — that's unchanged.) Unassigned users are handled
-- as full-access in application code (rollout safety), so legacy admins keep working.

create or replace function public.get_user_features(p_user_id uuid)
returns table (feature_key text, label text, hub_key text, path text, sort_order int)
language sql stable security definer set search_path = public as $$
  -- Bypass: member of an is_admin department → every active feature.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  where f.is_active and exists (
    select 1 from public.department_members dm
    join public.departments d on d.id = dm.department_id
    where dm.user_id = p_user_id and d.is_admin
  )
  union
  -- Otherwise: distinct enabled grants across the user's active departments.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  join public.department_features df on df.feature_id = f.id and df.enabled
  join public.department_members dm on dm.department_id = df.department_id and dm.user_id = p_user_id
  join public.departments d on d.id = df.department_id and d.is_active
  where f.is_active;
$$;

-- 21) CEO Hub — schema + RLS.
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

-- 22) CEO Hub — 24-KPI registry + 4 meetings seed.
-- CEO Hub seed — the 24-KPI registry and 4 meeting workflows (from the mockup data).
-- Values (actuals) are computed by the snapshot job, not seeded. AI diagnosis/solutions
-- are generated by the cron, not seeded. Weights: founder_activation=3, trial_to_paid=2,
-- commitment_completion=2, all others 1.

insert into public.ceo_kpi_registry (key, dept, label, owner, fmt, direction, scales_with_period, target, red_line, weight, benchmark, source_view, sort_order) values
-- Sales
('sales_new_leads','sales','New leads','Sales lead','n','up_good',true,400,300,1,'No universal norm — volume target sized to feed 90 meetings at current conversion.','v_ceo_sales_rollup',10),
('sales_lead_to_meeting','sales','Lead → meeting rate','Sales lead','%','up_good',false,25,18,1,'Early-stage B2B SaaS peer norm ~25–30% with warm sources dominant.','v_ceo_sales_rollup',20),
('sales_meetings_held','sales','Meetings held','Sales lead','n','up_good',true,90,65,1,'Function of leads × conversion — benchmark internally against the 90/wk plan.','v_ceo_sales_rollup',30),
('sales_meeting_to_trial','sales','Meeting → trial rate','Sales lead','%','up_good',false,65,50,1,'Demo→trial for product-led B2B ~50–65%.','v_ceo_sales_rollup',40),
('sales_trial_to_paid','sales','Trial → paid rate','Sales lead','%','up_good',false,20,12,2,'Opt-in free-trial SaaS norm ~15–25%.','v_ceo_sales_rollup',50),
('sales_new_paid','sales','New paid founders','Sales lead','n','up_good',true,12,7,1,'Pace check: 12/wk sustains the 200-active-founder Q3 goal with churn <=2%.','v_ceo_sales_rollup',60),
('sales_first_response','sales','First-response time','Sales ops','h','down_good',false,24,48,1,'Lead-response research: contact within 24h multiplies qualification; within 1h is elite.','v_ceo_sales_rollup',70),
('sales_investor_walkthroughs','sales','Investor walkthroughs ≤ 24h','Sales lead','%','up_good',false,80,50,1,'New KPI — norm not established. Target set from concierge-onboarding best practice.','v_ceo_sales_rollup',80),
-- Marketing
('mktg_sourced_leads','marketing','Marketing-sourced leads','Marketing','n','up_good',true,300,200,1,'Internal pace metric — sized to feed the sales plan at current conversion.','v_ceo_marketing_rollup',10),
('mktg_lead_to_meeting','marketing','Lead → meeting (mktg-sourced)','Marketing','%','up_good',false,22,15,1,'B2B SaaS marketing-sourced norm ~20–25% for warm content-led motions.','v_ceo_marketing_rollup',20),
('mktg_blended_cpl','marketing','Blended CPL','Marketing','$','down_good',false,15,30,1,'B2B SaaS blended CPL norm ~$30–60. Under band when organic mix is strong.','v_ceo_marketing_rollup',30),
('mktg_campaign_roi','marketing','Campaign ROI','Marketing','x','up_good',false,3,1,1,'Common B2B threshold >=3× attributed pipeline to cost.','v_ceo_marketing_rollup',40),
('mktg_site_to_signup','marketing','Site → signup conversion','Marketing','%','up_good',false,4,2,1,'B2B SaaS visitor→trial norm ~2–5%.','v_ceo_marketing_rollup',50),
('mktg_investor_signups','marketing','Investor-side signups','Marketing','n','up_good',true,20,10,1,'Internal pace metric — two-sided balance: >=1 active investor per 8 founders.','v_ceo_marketing_rollup',60),
('mktg_email_ctr','marketing','Email engagement (CTR)','Marketing','%','up_good',false,3.5,2,1,'B2B norm ~2–3% unique CTR; internal Q2 baseline was 3.6%.','v_ceo_marketing_rollup',70),
('mktg_targets_compliance','marketing','Targets-at-launch compliance','Marketing','%','up_good',false,100,99,1,'Process KPI — the norm is whatever you enforce. Binary by design.','v_ceo_marketing_rollup',80),
-- Operations
('ops_tasks_completed','operations','Tasks completed','Khris','n','up_good',true,30,18,1,'Internal throughput baseline — benchmark against your own 4-week average.','v_ceo_ops_rollup',10),
('ops_cycle_time','operations','Cycle time','Khris','d','down_good',false,2.5,4,1,'Small-team norm 2–4 days create→done for well-scoped tasks.','v_ceo_ops_rollup',20),
('ops_overdue_tasks','operations','Overdue tasks','Khris','n','down_good',false,3,8,1,'Target <=3 — sized so every overdue item can be discussed by name in one meeting.','v_ceo_ops_rollup',30),
('ops_blocked_7d','operations','Blocked > 7 days','Khris','n','down_good',false,0,3,1,'Target zero — a week-old blocker is a decision hiding as a dependency.','v_ceo_ops_rollup',40),
('ops_commitment_completion','operations','Commitment completion','All leads','%','up_good',false,85,60,2,'High-accountability team norm >=85% of meeting commitments done by due date.','v_ceo_ops_rollup',50),
('ops_recap_discipline','operations','Recap discipline (≤ 2h)','Meeting owners','%','up_good',false,100,75,1,'Binary process KPI — recap + journal entry within 2h of every meeting.','v_ceo_ops_rollup',60),
('ops_founder_activation','operations','Founder activation (≤ 7d)','Platform','%','up_good',false,70,45,3,'SaaS aha-within-a-week norms ~40–60%; the bar is set high deliberately.','v_ceo_ops_rollup',70),
('ops_stale_escalations','operations','Stale-item escalations resolved','Khris','%','up_good',false,100,70,1,'Process KPI — items escalated after 2 unchanged meetings must resolve same week.','v_ceo_ops_rollup',80)
on conflict (key) do nothing;

-- Meetings (agenda = during-blocks; workflow = before/after/rules)
insert into public.ceo_meetings (key, name, dept, day_of_week, time_local, timezone, duration_min, attendees, agenda, workflow) values
('sales','Sales meeting','sales',2,'10:00','America/Los_Angeles',60,
  '[{"name":"Sales team"},{"name":"Khris"}]',
  '[{"title":"Log note opened from the calendar event — attendance, decisions, tasks captured live","minutes":0},{"title":"KPI vs goal — discuss misses only","minutes":5},{"title":"Pipeline walkthrough — exceptions first (stalled trials, hot leads)","minutes":20},{"title":"Training block — current sales program module","minutes":25},{"title":"Assignments & decisions — owner + due date required","minutes":10}]',
  '{"before":["Recurring Google Calendar invite with Meet link — agenda + AI pre-brief attached to the event","Pipeline & task statuses updated by EOD Monday — no verbal recitation in the meeting","AI pre-brief: stale deals, funnel exceptions, commitments from last week"],"after":["Log note saved to the meeting log — searchable by date, decision, and owner","Recap posted within 2 hours: decisions, new tasks, escalations","Tasks sync to the task board; KPI numbers land in the weekly snapshot → Dashboard","AI compares commitments vs completions and flags slippage in next pre-brief"],"rules":"No task without an owner and due date · any item untouched for 2 consecutive meetings is escalated to Management or killed · training tracked in the program log, not the meeting notes."}'),
('mktg','Marketing meeting','marketing',3,'10:00','America/Los_Angeles',30,
  '[{"name":"Marketing"},{"name":"Khris"}]',
  '[{"title":"Log note opened from the calendar event — decisions and tasks captured live","minutes":0},{"title":"KPI vs goal — leads, conversion, CPL vs target","minutes":5},{"title":"Campaign walkthrough — exceptions first","minutes":15},{"title":"New assignments — owner + due date","minutes":5},{"title":"Escalations to Management agenda","minutes":5}]',
  '{"before":["Recurring Google Calendar invite with Meet link — agenda + AI pre-brief attached to the event","Campaign metrics pre-filled by EOD Tuesday","AI pre-brief: lead→meeting deltas by source, underperforming variants"],"after":["Log note saved to the meeting log — searchable by date, decision, and owner","Recap within 2 hours; tasks sync to board","Snapshot feeds Dashboard lead-conversion metrics","Losing variants paused same day — not next cycle"],"rules":"Every campaign gets a numeric target at launch · a variant losing 2 consecutive weeks is pulled · no new campaign while a red KPI is unowned."}'),
('mgmt','Management meeting','operations',1,'09:00','America/Los_Angeles',45,
  '[{"name":"Khris"},{"name":"Dept leads"}]',
  '[{"title":"Log note opened from the calendar event — attendance, decisions, tasks captured live","minutes":0},{"title":"Announcements — company, personnel, partnerships","minutes":5},{"title":"Company outlook — quarter position, one headline","minutes":5},{"title":"Department reporting — exceptions only, 3 min per lead","minutes":15},{"title":"Decisions needed — max 2 topics, each ends with a recorded decision + owner","minutes":15},{"title":"Assignments recap — read back owner, due date, priority","minutes":5}]',
  '{"before":["Recurring Google Calendar invite with Meet link — AI weekly brief attached as the pre-read","Dept leads update statuses & KPIs by EOD Friday","Meeting opens on exceptions — pre-read is assumed"],"after":["Log note saved to the meeting log — decision records logged separately from tasks","Escalated items assigned and dated","Recap posted within 2 hours"],"rules":"Pre-read is assumed — status updates are never given verbally · decisions are captured as records (what, who, when), not buried in notes."}'),
('staff','Staff meeting','operations',1,'10:00','America/Los_Angeles',30,
  '[{"name":"All staff"}]',
  '[{"title":"Log note opened from the calendar event","minutes":0},{"title":"Company announcements","minutes":10},{"title":"Event & conference assignments — MC, opening, networking roles","minutes":10},{"title":"Recognition + open Q&A","minutes":10}]',
  '{"before":["Recurring Google Calendar invite with Meet link — all staff","Announcements and event/role items collected in advance"],"after":["Log note saved to the meeting log","Role assignments sync to the task board with dates","Recap posted to the team channel"],"rules":"Follows Management same morning — decisions flow down, never re-litigated · every assigned role has a named backup."}')
on conflict (key) do nothing;


-- ============================================================
-- CEO Hub v2 — meeting recurrence + occurrences + phrase of the day
-- (migration 20260708003_ceo_hub_v2)
-- ============================================================

-- CEO Hub v2 — meeting recurrence + one-off occurrences, and the metric-aware
-- daily "phrase of the day". Recurrence reuses the existing ceo_meetings.cadence
-- column (weekly | biweekly | monthly). Occurrences are one-off scheduled dates
-- layered on top of the recurring slot; both render in the new calendar views.
-- Admin-only; gated by the existing is_staff() helper like the rest of ceo_*.

-- Normalize cadence to the recurrence vocabulary the UI uses.
alter table public.ceo_meetings
  alter column cadence set default 'weekly';
update public.ceo_meetings set cadence = 'weekly'
  where cadence is null or cadence not in ('weekly','biweekly','monthly');

-- One-off scheduled occurrences (a specific date/time for a meeting, in addition
-- to the recurring slot). gcal_event_id is set if synced to Google Calendar.
create table if not exists public.ceo_meeting_occurrences (
  id uuid primary key default gen_random_uuid(),
  meeting_key text not null references public.ceo_meetings(key) on delete cascade,
  occurs_on date not null,
  time_local time,
  duration_min int,
  note text,
  gcal_event_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (meeting_key, occurs_on)
);
create index if not exists ceo_meeting_occurrences_date_idx
  on public.ceo_meeting_occurrences (occurs_on);

-- Metric-aware daily phrase shown on the CEO Hub dashboard (one row per day).
create table if not exists public.ceo_daily_phrase (
  id uuid primary key default gen_random_uuid(),
  business ceo_business not null default 'icapos',
  phrase_date date not null,
  phrase text not null,
  model text,
  created_at timestamptz default now(),
  unique (business, phrase_date)
);

-- RLS — reuse is_staff() (admin/analyst), same as every other ceo_* table.
alter table public.ceo_meeting_occurrences enable row level security;
alter table public.ceo_daily_phrase        enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['ceo_meeting_occurrences','ceo_daily_phrase'] loop
    execute format('drop policy if exists %I_staff on public.%I', tbl, tbl);
    execute format('create policy %I_staff on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', tbl, tbl);
  end loop;
end $$;


-- ============================================================
-- Marketing webhook diagnostics log (migration 20260708004)
-- ============================================================

-- Marketing webhook diagnostics. Records every inbound Resend/Svix webhook attempt
-- (verified or not) so the Analytics page can tell WHY tracking isn't flowing:
-- no calls at all (endpoint not set in Resend) vs calls rejected (secret mismatch)
-- vs verified-but-unmatched (send didn't record resend_id) vs recorded. Writes are
-- service-role only (the webhook); reads are staff-gated at the API layer.

create table if not exists public.marketing_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  verified boolean not null default false,
  event_type text,
  outcome text not null,
  detail text
);
create index if not exists marketing_webhook_log_received_idx
  on public.marketing_webhook_log (received_at desc);

alter table public.marketing_webhook_log enable row level security;
drop policy if exists marketing_webhook_log_staff on public.marketing_webhook_log;
create policy marketing_webhook_log_staff on public.marketing_webhook_log
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ============================================================
-- Repair marketing sender to verified icapos.com (migration 20260708005)
-- ============================================================

-- Repair the marketing sender to the ONLY verified sending domain: icapos.com.
-- Unverified sender domains (mail.icapos.com, mail.myicfos.com, myicfos.com,
-- resend.dev) make Resend reject every send with "domain not verified" — nothing
-- goes out and nothing can be tracked. This fixes existing campaigns/steps AND the
-- column defaults. reply_to (e.g. admin@myicfos.com) is intentionally left alone —
-- that's a receiving address, not a sender.

update public.marketing_campaigns
  set from_email = 'outreach@icapos.com'
  where from_email is null
     or from_email ilike '%@mail.icapos.com'
     or from_email ilike '%@mail.myicfos.com'
     or from_email ilike '%@myicfos.com'
     or from_email ilike '%@resend.dev';

update public.marketing_sequence_steps
  set from_email = 'outreach@icapos.com'
  where from_email is null
     or from_email ilike '%@mail.icapos.com'
     or from_email ilike '%@mail.myicfos.com'
     or from_email ilike '%@myicfos.com'
     or from_email ilike '%@resend.dev';

alter table public.marketing_campaigns      alter column from_email set default 'outreach@icapos.com';
alter table public.marketing_sequence_steps alter column from_email set default 'outreach@icapos.com';


-- ============================================================
-- Fix opens/clicks: drop UNIQUE on marketing_events.resend_id (migration 20260708006)
-- ============================================================

-- ROOT CAUSE of "opens/clicks always 0": marketing_events.resend_id was UNIQUE.
-- One email (one resend_id) legitimately produces MANY events — sent, delivered,
-- opened, clicked, bounced. The unique constraint let the initial "sent" row in,
-- then silently rejected every webhook event that reused the same resend_id, so
-- delivered/opened/clicked never persisted. Drop the unique constraint; a plain
-- lookup index (marketing_events_resend_idx) already exists for the webhook join.
alter table public.marketing_events drop constraint if exists marketing_events_resend_id_key;


-- ============================================================
-- Security fix C1: enable RLS on publish_items / publish_events (migration 20260708007)
-- ============================================================
-- These two tables shipped WITHOUT row level security, so the public anon key
-- could read contact emails from publish_events. App code uses the service-role
-- client (bypasses RLS), so this is behavior-preserving.
alter table public.publish_items  enable row level security;
alter table public.publish_events enable row level security;

drop policy if exists publish_items_staff on public.publish_items;
create policy publish_items_staff on public.publish_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists publish_events_staff on public.publish_events;
create policy publish_events_staff on public.publish_events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.publish_items  from anon, authenticated;
revoke all on public.publish_events from anon, authenticated;


-- ============================================================
-- Performance fix H5: learning analytics aggregation RPCs (migration 20260708008)
-- ============================================================
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

create or replace function public.learning_module_engagement_counts()
returns table(module_id uuid, cnt bigint)
language sql stable security definer set search_path = public as $$
  select module_id, count(*) as cnt
  from public.learning_progress
  where status <> 'not_started'
  group by module_id;
$$;

grant execute on function public.learning_company_last_activity()    to service_role;
grant execute on function public.learning_leaderboard_stats()        to service_role;
grant execute on function public.learning_module_engagement_counts() to service_role;


-- ============================================================
-- Performance fix C2: partner_score_snapshots table (migration 20260708009)
-- ============================================================
create table if not exists public.partner_score_snapshots (
  investor_id uuid primary key references public.profiles(id) on delete cascade,
  score       integer,
  tier        text    not null,
  status      text    not null,
  sample_size integer not null default 0,
  payload     jsonb   not null,
  computed_at timestamptz not null default now()
);
alter table public.partner_score_snapshots enable row level security;
drop policy if exists partner_score_snapshots_staff on public.partner_score_snapshots;
create policy partner_score_snapshots_staff on public.partner_score_snapshots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());


-- ============================================================
-- Scheduling: offer multiple meeting lengths (migration 20260709001)
-- ============================================================
alter table public.scheduling_availability
  add column if not exists slot_durations jsonb;


-- ============================================================
-- Sales Forecast batch A: core tables + actuals view (migrations 20260709002/003)
-- ============================================================
-- Sales Hub — Forecast & Projection module, batch A (forecast core).
-- Convention: RLS enabled with NO policy → service-role only; all access via admin
-- API routes gated by requireRole(["admin","analyst"]). Immutability (snapshots) is
-- enforced by a trigger so it holds even against the service role.
-- Segments use the subscription `role` vocabulary: 'founder' | 'investor' (or null = global).

-- ── Scenarios ────────────────────────────────────────────────────────────────
create table if not exists public.sales_forecast_scenarios (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null default 'custom' check (kind in ('base','upside','downside','custom')),
  horizon_months int  not null default 36 check (horizon_months between 1 and 120),
  start_month    date not null default date_trunc('month', now())::date,
  is_active      boolean not null default false,
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- At most one active scenario per kind (drives CEO Base headline + default selection).
create unique index if not exists sales_forecast_scenarios_active_kind
  on public.sales_forecast_scenarios (kind) where is_active;
alter table public.sales_forecast_scenarios enable row level security;

-- ── Assumptions (driver grid) ────────────────────────────────────────────────
create table if not exists public.sales_forecast_assumptions (
  id          uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.sales_forecast_scenarios(id) on delete cascade,
  driver_key  text not null,
  segment     text check (segment in ('founder','investor','hot','warm','cold')),
  month_from  int  not null default 0 check (month_from >= 0),
  month_to    int  not null default 0 check (month_to >= month_from),
  value       numeric not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
-- Most-specific match keyed on (scenario, driver, segment, month_from); null segment = global.
create unique index if not exists sales_forecast_assumptions_uniq
  on public.sales_forecast_assumptions (scenario_id, driver_key, coalesce(segment, ''), month_from);
create index if not exists sales_forecast_assumptions_scenario_idx
  on public.sales_forecast_assumptions (scenario_id);
alter table public.sales_forecast_assumptions enable row level security;

-- ── Snapshots (immutable) ────────────────────────────────────────────────────
create table if not exists public.sales_forecast_snapshots (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references public.sales_forecast_scenarios(id) on delete cascade,
  computed_at      timestamptz not null default now(),
  engine_version   text not null,
  assumptions_hash text not null,
  output           jsonb not null,
  created_by       uuid references public.profiles(id)
);
create index if not exists sales_forecast_snapshots_scenario_idx
  on public.sales_forecast_snapshots (scenario_id, computed_at desc);
alter table public.sales_forecast_snapshots enable row level security;

-- Immutability: block UPDATE/DELETE on snapshots (even for service role).
create or replace function public.sales_forecast_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'sales_forecast_snapshots rows are immutable (% blocked)', tg_op;
end;
$$;
drop trigger if exists sales_forecast_snapshots_immutable on public.sales_forecast_snapshots;
create trigger sales_forecast_snapshots_immutable
  before update or delete on public.sales_forecast_snapshots
  for each row execute function public.sales_forecast_block_mutation();

-- ── Pipeline weights (per real CRM stage) ────────────────────────────────────
create table if not exists public.sales_forecast_pipeline_weights (
  id               uuid primary key default gen_random_uuid(),
  stage_id         uuid not null references public.sales_stages(id) on delete cascade,
  win_probability  numeric not null default 0 check (win_probability between 0 and 1),
  expected_lag_days int not null default 30 check (expected_lag_days >= 0),
  is_active        boolean not null default true,
  updated_by       uuid references public.profiles(id),
  updated_at       timestamptz not null default now(),
  unique (stage_id)
);
alter table public.sales_forecast_pipeline_weights enable row level security;

-- ── Targets (v1-optional; empty until used) ──────────────────────────────────
create table if not exists public.sales_forecast_targets (
  id           uuid primary key default gen_random_uuid(),
  metric_key   text not null,
  month        int  not null check (month >= 0),
  segment      text check (segment in ('founder','investor','hot','warm','cold')),
  target_value numeric not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create unique index if not exists sales_forecast_targets_uniq
  on public.sales_forecast_targets (metric_key, month, coalesce(segment, ''));
alter table public.sales_forecast_targets enable row level security;

-- ── Actuals view — monthly recurring-revenue roll-up from real billing ────────
-- Source of truth: public.subscriptions (one row per profile). We lack per-month MRR
-- history, so new/churned MRR are derived from created_at / churn month, and ending
-- MRR is a running cumulative of (new − churned). Segment = subscription role.
create or replace view public.v_sales_forecast_actuals as
with months as (
  select generate_series(
           date_trunc('month', coalesce((select min(created_at) from public.subscriptions), now())),
           date_trunc('month', now()),
           interval '1 month'
         )::date as month
),
seg(segment) as (values ('founder'), ('investor')),
grid as (
  select m.month, s.segment from months m cross join seg s
),
new_m as (
  select date_trunc('month', created_at)::date as month,
         role as segment,
         count(*) as new_subs,
         coalesce(sum(monthly_price_cents), 0)::bigint as new_mrr_cents
  from public.subscriptions
  where role in ('founder','investor') and monthly_price_cents > 0
  group by 1, 2
),
churn_m as (
  select date_trunc('month', updated_at)::date as month,
         role as segment,
         count(*) as churned_subs,
         coalesce(sum(monthly_price_cents), 0)::bigint as churned_mrr_cents
  from public.subscriptions
  where role in ('founder','investor')
    and subscription_status in ('canceled','expired')
  group by 1, 2
)
select
  g.month,
  g.segment,
  coalesce(n.new_subs, 0)          as new_subs,
  coalesce(n.new_mrr_cents, 0)     as new_mrr_cents,
  coalesce(c.churned_subs, 0)      as churned_subs,
  coalesce(c.churned_mrr_cents, 0) as churned_mrr_cents,
  sum(coalesce(n.new_subs, 0) - coalesce(c.churned_subs, 0))
    over (partition by g.segment order by g.month)      as active_subs,
  sum(coalesce(n.new_mrr_cents, 0) - coalesce(c.churned_mrr_cents, 0))
    over (partition by g.segment order by g.month)      as ending_mrr_cents
from grid g
left join new_m   n on n.month = g.month and n.segment = g.segment
left join churn_m c on c.month = g.month and c.segment = g.segment
order by g.month, g.segment;

-- Sales Forecast — batch A seeds. Idempotent: creates the default Base scenario with
-- PLACEHOLDER drivers only if no Base scenario exists yet, and seeds pipeline weights
-- for any CRM stage that doesn't have one. Replace PLACEHOLDER values during calibration.

do $$
declare
  v_scenario uuid;
begin
  select id into v_scenario from public.sales_forecast_scenarios where kind = 'base' limit 1;

  if v_scenario is null then
    insert into public.sales_forecast_scenarios (name, kind, is_active, notes)
    values ('Base', 'base', true, 'PLACEHOLDER — calibrate drivers before the first official snapshot')
    returning id into v_scenario;

    -- Global (segment = null) PLACEHOLDER drivers. Rates are 0..1; arpu_monthly is CENTS.
    insert into public.sales_forecast_assumptions (scenario_id, driver_key, segment, month_from, month_to, value) values
      (v_scenario, 'leads_per_month',             null, 0, 0, 100),
      (v_scenario, 'lead_growth_rate_mom',        null, 0, 0, 0.05),
      (v_scenario, 'lead_to_mql',                 null, 0, 0, 0.40),
      (v_scenario, 'mql_to_sql',                  null, 0, 0, 0.50),
      (v_scenario, 'sql_to_trial',                null, 0, 0, 0.60),
      (v_scenario, 'trial_to_paid',               null, 0, 0, 0.30),
      (v_scenario, 'avg_sales_cycle_days',        null, 0, 0, 30),
      (v_scenario, 'arpu_monthly',                null, 0, 0, 49900),
      (v_scenario, 'annual_prepay_mix',           null, 0, 0, 0.30),
      (v_scenario, 'price_change_pct',            null, 0, 0, 0),
      (v_scenario, 'logo_churn_monthly',          null, 0, 0, 0.03),
      (v_scenario, 'expansion_mrr_pct_monthly',   null, 0, 0, 0.01),
      (v_scenario, 'contraction_mrr_pct_monthly', null, 0, 0, 0.005);
  end if;

  -- Pipeline weights for any active stage lacking one. Placeholder probabilities scale
  -- with sort_order; won stages = 1.0.
  insert into public.sales_forecast_pipeline_weights (stage_id, win_probability, expected_lag_days)
  select s.id,
         case when s.is_won then 1.0
              else least(0.90, greatest(0.05, round(((s.sort_order + 1) * 0.18)::numeric, 2))) end,
         30
  from public.sales_stages s
  where not exists (
    select 1 from public.sales_forecast_pipeline_weights w where w.stage_id = s.id
  );
end $$;


-- ============================================================
-- Sales Forecast batch B: AI insights + journal + task source (migration 20260709004)
-- ============================================================
-- Sales Forecast batch B: AI insights (immutable), sales journal (append-only),
-- and task source linkage. RLS enabled, service-role access via admin routes.

-- ── AI Sales insights (immutable; regeneration inserts a new row) ─────────────
create table if not exists public.sales_ai_insights (
  id               uuid primary key default gen_random_uuid(),
  metric_key       text not null check (metric_key in ('mrr','arr','proj','variance')),
  snapshot_id      uuid references public.sales_forecast_snapshots(id) on delete cascade,
  generated_at     timestamptz not null default now(),
  model            text,
  input_hash       text not null,
  narrative        text not null,
  drivers          jsonb not null default '[]',
  suggested_actions jsonb not null default '[]',
  created_by       uuid references public.profiles(id)
);
create index if not exists sales_ai_insights_lookup_idx
  on public.sales_ai_insights (metric_key, snapshot_id, generated_at desc);
alter table public.sales_ai_insights enable row level security;

drop trigger if exists sales_ai_insights_immutable on public.sales_ai_insights;
create trigger sales_ai_insights_immutable
  before update or delete on public.sales_ai_insights
  for each row execute function public.sales_forecast_block_mutation();

-- ── Sales journal (append-only; only `pinned` mutable; no deletes) ────────────
create table if not exists public.sales_journal_entries (
  id           uuid primary key default gen_random_uuid(),
  entry_type   text not null check (entry_type in ('note','win','loss','deal','system')),
  body         text not null,
  tags         text[] not null default '{}',
  pinned       boolean not null default false,
  author_id    uuid references public.profiles(id),   -- null = system
  deal_ref     uuid,
  snapshot_ref uuid references public.sales_forecast_snapshots(id) on delete set null,
  revision_of  uuid references public.sales_journal_entries(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists sales_journal_created_idx on public.sales_journal_entries (created_at desc);
create index if not exists sales_journal_type_idx on public.sales_journal_entries (entry_type);
alter table public.sales_journal_entries enable row level security;

create or replace function public.sales_journal_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'sales_journal_entries cannot be deleted (append-only)';
  end if;
  if (new.entry_type, new.body, new.tags, new.author_id, new.deal_ref, new.snapshot_ref, new.revision_of, new.created_at)
     is distinct from
     (old.entry_type, old.body, old.tags, old.author_id, old.deal_ref, old.snapshot_ref, old.revision_of, old.created_at) then
    raise exception 'sales_journal_entries are append-only (only pinned is mutable)';
  end if;
  return new;
end;
$$;
drop trigger if exists sales_journal_guard on public.sales_journal_entries;
create trigger sales_journal_guard
  before update or delete on public.sales_journal_entries
  for each row execute function public.sales_journal_guard();

-- ── Task source linkage (reuse existing sales_tasks) ─────────────────────────
alter table public.sales_tasks add column if not exists source_kind text not null default 'manual';
alter table public.sales_tasks add column if not exists source_ref uuid;


-- ============================================================
-- IR Analytics: cached AI insights (migration 20260710001)
-- ============================================================
-- Investor Relations Analytics — cached AI analyst narratives (one per metric).
-- Read-model cache: regeneration inserts a new row; serve the latest per metric_key.
-- RLS enabled, service-role access via admin routes.
create table if not exists public.ir_analytics_insights (
  id                uuid primary key default gen_random_uuid(),
  metric_key        text not null,
  input_hash        text not null,
  generated_at      timestamptz not null default now(),
  model             text,
  narrative         text not null,
  drivers           jsonb not null default '[]',
  suggested_actions jsonb not null default '[]',
  created_by        uuid references public.profiles(id)
);
create index if not exists ir_analytics_insights_lookup_idx
  on public.ir_analytics_insights (metric_key, generated_at desc);
alter table public.ir_analytics_insights enable row level security;
