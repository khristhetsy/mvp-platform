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
