-- Founder IR agents: one agent page per founder organization at icapos.com/[company_slug]/[ending].
-- Founders build it in Deploy > My IR Agent. Public pages and replies are served by
-- server routes using the service role, so there is deliberately NO anon read policy.
--
-- Org scoping uses public.is_member(org_id) (20260808002_multi_account_step1.sql) for
-- reads and public.ir_agent_can_edit(org_id) below for writes (viewers read only).
-- Staff access uses public.is_staff() (0007_admin_platform_linking.sql), the same
-- pattern as the valuation studio tables. Agents are created by a server route
-- (service role) after the plan, override and feature flag checks.

-- Owners, admins and members may edit the agent. Viewers may only read.
create or replace function public.ir_agent_can_edit(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.org_id  = target_org
      and m.role in ('owner', 'admin', 'member')
  );
$$;

revoke execute on function public.ir_agent_can_edit(uuid) from public;
grant  execute on function public.ir_agent_can_edit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------
create table if not exists public.ir_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  -- Generated from the company name and locked. One organization per slug.
  company_slug text not null unique,
  ending text not null default 'invest',
  display_name text not null,
  welcome_message text,
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'live', 'paused')),
  -- ir_agent_template.version this agent was copied from.
  template_version integer not null default 0,
  host_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ir_agents_company_slug_format
    check (company_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(company_slug) between 3 and 40),
  constraint ir_agents_ending_format
    check (ending ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(ending) between 2 and 30)
);
-- Email sends follow organizations.email_dispatch_enabled (demo and internal orgs are off).
-- No separate flag here, so the two can never disagree.

create index if not exists ir_agents_host_profile_idx on public.ir_agents (host_profile_id);

create table if not exists public.ir_agent_reserved_slugs (
  slug text primary key
);

-- Every top level path on icapos.com (src/app, src/app/(marketing), public/ folders),
-- plus names kept back for the future. Mirrors RESERVED_SLUGS in src/lib/ir-agent/slug.ts.
insert into public.ir_agent_reserved_slugs (slug) values
  ('about'), ('about-us'), ('admin'), ('api'), ('app'), ('apple-icon'), ('assessment'), ('auth'),
  ('billing'), ('blog'), ('campaigns'), ('checkout'), ('claim'), ('configuration-error'),
  ('connect'), ('contact'), ('contracts'), ('credits'), ('daniela'), ('dashboard'), ('deal'),
  ('deals'), ('deck'), ('disclosures'), ('dr'), ('email'), ('events'), ('favicon'), ('fit'),
  ('founder'), ('founders'), ('help'), ('home'), ('icapos'), ('icfo'), ('icon'), ('install'),
  ('invite'), ('investor'), ('investors'), ('jessica'), ('jessica2'), ('johnny'), ('khris'),
  ('learn'), ('legal'), ('login'), ('logout'), ('manifest'), ('marketing'), ('marketplace'),
  ('matches'), ('mc'), ('michael'), ('notifications'), ('offline'), ('onboarding'),
  ('opengraph-image'), ('pay'), ('preview'), ('pricing'), ('privacy'), ('private-market'),
  ('readiness'), ('readiness-rating'), ('register'), ('robots'), ('schedule'), ('security'),
  ('settings'), ('share'), ('sign'), ('sign-in'), ('sign-up'), ('signin'), ('signup'),
  ('sitemap'), ('sponsor'), ('start'), ('submit-company'), ('support'), ('terms'),
  ('testimonial'), ('twitter-image'), ('unsubscribe'), ('upgrade'), ('www')
on conflict (slug) do nothing;

-- Security definer: founders write ir_agents through RLS, and ir_agent_reserved_slugs
-- has no policies, so an invoker function would read zero rows and let a reserved slug in.
create or replace function public.ir_agents_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Checked only when the slug is set, so reserving a name later never blocks
  -- edits (or pausing) on an agent that already uses it.
  if tg_op = 'INSERT' or new.company_slug is distinct from old.company_slug then
    if exists (select 1 from public.ir_agent_reserved_slugs r where r.slug = new.company_slug) then
      raise exception 'company_slug % is reserved', new.company_slug;
    end if;
  end if;
  -- The company slug is locked once created. Only the service role may change it
  -- (in the SQL editor, first: set local request.jwt.claims = '{"role":"service_role"}').
  if tg_op = 'UPDATE' and new.company_slug is distinct from old.company_slug
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'company_slug is locked';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ir_agents_before_write on public.ir_agents;
create trigger ir_agents_before_write
  before insert or update on public.ir_agents
  for each row execute function public.ir_agents_before_write();

-- ---------------------------------------------------------------------------
-- Agent content
-- ---------------------------------------------------------------------------
create table if not exists public.ir_agent_questions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  field text not null check (field in
    ('investor_type', 'preferred_sectors', 'check_size', 'preferred_stages', 'capital_types', 'custom')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  position integer not null,
  enabled boolean not null default true,
  is_default boolean not null default true,
  edited boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ir_agent_questions_agent_idx on public.ir_agent_questions (agent_id, position);

create table if not exists public.ir_agent_contact_fields (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  key text not null,
  label text not null,
  kind text not null check (kind in ('short_text', 'email', 'phone', 'dropdown')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  position integer not null,
  unique (agent_id, key)
);

-- Training sources. PDF only, matching the platform rule for founder document uploads.
create table if not exists public.ir_agent_sources (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  file_name text not null check (lower(file_name) like '%.pdf'),
  storage_path text not null,
  status text not null default 'processing' check (status in ('processing', 'trained', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists ir_agent_sources_agent_idx on public.ir_agent_sources (agent_id);

-- Answers the founder taught the agent, and corrections from conversation review.
create table if not exists public.ir_agent_answers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
create index if not exists ir_agent_answers_agent_idx on public.ir_agent_answers (agent_id);

-- Visitor conversations. Inserted only by the public reply route (service role).
create table if not exists public.ir_agent_conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  source text not null default 'direct',
  transcript jsonb not null default '[]'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  review_state text not null default 'new' check (review_state in ('new', 'needs_review', 'approved')),
  booked_at timestamptz,
  stopped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ir_agent_conversations_agent_idx
  on public.ir_agent_conversations (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Admin: master template and access control (Feature Controls)
-- ---------------------------------------------------------------------------
-- Single row. Copied into a new agent at creation; edits reach new agents only.
-- Empty until an admin first saves it; until then src/lib/ir-agent/defaults.ts is used.
create table if not exists public.ir_agent_template (
  id smallint primary key default 1 check (id = 1),
  version integer not null default 1,
  welcome_message text,
  questions jsonb not null default '[]'::jsonb,
  contact_fields jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Plans that include the IR agent (founder_basic, founder_professional, ...). No row = not included.
create table if not exists public.ir_agent_plan_access (
  plan_key text primary key,
  updated_at timestamptz not null default now()
);

-- Per founder override: true grants it outside their plan, false removes it.
create table if not exists public.ir_agent_access_overrides (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Master switch, OFF until an admin turns it on in Feature Controls.
insert into public.feature_flags (audience, feature, enabled)
values ('founder', 'ir_agent', false)
on conflict (audience, feature) do nothing;

-- ---------------------------------------------------------------------------
-- Storage. Uploads go through server routes (service role), so no object policies.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- No SVG: a public SVG can carry script (stored XSS). PNG, JPG and WebP only.
values ('ir-agent-images', 'ir-agent-images', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ir-agent-sources', 'ir-agent-sources', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.ir_agents enable row level security;
alter table public.ir_agent_reserved_slugs enable row level security;
alter table public.ir_agent_questions enable row level security;
alter table public.ir_agent_contact_fields enable row level security;
alter table public.ir_agent_sources enable row level security;
alter table public.ir_agent_answers enable row level security;
alter table public.ir_agent_conversations enable row level security;
alter table public.ir_agent_template enable row level security;
alter table public.ir_agent_plan_access enable row level security;
alter table public.ir_agent_access_overrides enable row level security;

-- Founders: read their own organization's agent, edit it if not a viewer.
-- No insert or delete policy: the server route creates agents after the access checks.
-- Staff: read everything for support.
drop policy if exists ir_agents_member_read on public.ir_agents;
create policy ir_agents_member_read on public.ir_agents
  for select to authenticated
  using (public.is_member(organization_id));

drop policy if exists ir_agents_member_update on public.ir_agents;
create policy ir_agents_member_update on public.ir_agents
  for update to authenticated
  using      (public.ir_agent_can_edit(organization_id))
  with check (public.ir_agent_can_edit(organization_id));

drop policy if exists ir_agents_staff_read on public.ir_agents;
create policy ir_agents_staff_read on public.ir_agents
  for select to authenticated
  using (public.is_staff());

drop policy if exists ir_agent_questions_member_read on public.ir_agent_questions;
create policy ir_agent_questions_member_read on public.ir_agent_questions
  for select to authenticated
  using (exists (select 1 from public.ir_agents a where a.id = agent_id and public.is_member(a.organization_id)));

drop policy if exists ir_agent_questions_member_write on public.ir_agent_questions;
create policy ir_agent_questions_member_write on public.ir_agent_questions
  for all to authenticated
  using      (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)))
  with check (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)));

drop policy if exists ir_agent_contact_fields_member_read on public.ir_agent_contact_fields;
create policy ir_agent_contact_fields_member_read on public.ir_agent_contact_fields
  for select to authenticated
  using (exists (select 1 from public.ir_agents a where a.id = agent_id and public.is_member(a.organization_id)));

drop policy if exists ir_agent_contact_fields_member_write on public.ir_agent_contact_fields;
create policy ir_agent_contact_fields_member_write on public.ir_agent_contact_fields
  for all to authenticated
  using      (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)))
  with check (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)));

drop policy if exists ir_agent_sources_member_read on public.ir_agent_sources;
create policy ir_agent_sources_member_read on public.ir_agent_sources
  for select to authenticated
  using (exists (select 1 from public.ir_agents a where a.id = agent_id and public.is_member(a.organization_id)));

drop policy if exists ir_agent_sources_member_write on public.ir_agent_sources;
create policy ir_agent_sources_member_write on public.ir_agent_sources
  for all to authenticated
  using      (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)))
  with check (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)));

drop policy if exists ir_agent_answers_member_read on public.ir_agent_answers;
create policy ir_agent_answers_member_read on public.ir_agent_answers
  for select to authenticated
  using (exists (select 1 from public.ir_agents a where a.id = agent_id and public.is_member(a.organization_id)));

drop policy if exists ir_agent_answers_member_write on public.ir_agent_answers;
create policy ir_agent_answers_member_write on public.ir_agent_answers
  for all to authenticated
  using      (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)))
  with check (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)));

-- Conversations: founders read, and editors change review_state only (column grant below).
-- Rows are inserted by the service role.
drop policy if exists ir_agent_conversations_member_read on public.ir_agent_conversations;
create policy ir_agent_conversations_member_read on public.ir_agent_conversations
  for select to authenticated
  using (exists (select 1 from public.ir_agents a where a.id = agent_id and public.is_member(a.organization_id)));

drop policy if exists ir_agent_conversations_member_update on public.ir_agent_conversations;
create policy ir_agent_conversations_member_update on public.ir_agent_conversations
  for update to authenticated
  using      (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)))
  with check (exists (select 1 from public.ir_agents a where a.id = agent_id and public.ir_agent_can_edit(a.organization_id)));

-- Founders may not rewrite the transcript, profile or contact a visitor gave.
revoke update on public.ir_agent_conversations from authenticated;
grant update (review_state) on public.ir_agent_conversations to authenticated;

drop policy if exists ir_agent_conversations_staff_read on public.ir_agent_conversations;
create policy ir_agent_conversations_staff_read on public.ir_agent_conversations
  for select to authenticated
  using (public.is_staff());

-- Admin tables: staff only.
drop policy if exists ir_agent_template_staff on public.ir_agent_template;
create policy ir_agent_template_staff on public.ir_agent_template
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists ir_agent_plan_access_staff on public.ir_agent_plan_access;
create policy ir_agent_plan_access_staff on public.ir_agent_plan_access
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists ir_agent_access_overrides_staff on public.ir_agent_access_overrides;
create policy ir_agent_access_overrides_staff on public.ir_agent_access_overrides
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Founders may read their own override (drives whether the tab shows).
drop policy if exists ir_agent_access_overrides_member_read on public.ir_agent_access_overrides;
create policy ir_agent_access_overrides_member_read on public.ir_agent_access_overrides
  for select to authenticated
  using (public.is_member(organization_id));

-- ir_agent_reserved_slugs: no policies, so only the service role and the
-- security definer trigger read it.
