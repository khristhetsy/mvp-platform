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
