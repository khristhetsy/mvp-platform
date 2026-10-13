-- Founder IR agents, part 2: columns the Build, Train and Conversations screens
-- need on top of 20261013120000_ir_agents.sql. Safe to run after it, on a database
-- where it has already been applied. Idempotent.

-- The agent speaks for a company, has a fact sheet, and shows a public image URL.
alter table public.ir_agents add column if not exists company_name text;
alter table public.ir_agents add column if not exists about text;
alter table public.ir_agents add column if not exists image_url text;
alter table public.ir_agents add column if not exists created_by uuid references public.profiles(id) on delete set null;
update public.ir_agents set company_name = display_name where company_name is null;
alter table public.ir_agents alter column company_name set not null;

-- Contact questions can be turned off without being deleted.
alter table public.ir_agent_contact_fields add column if not exists enabled boolean not null default true;

-- PDF text is read once at upload and kept on the row, so the reply route never touches storage.
alter table public.ir_agent_sources add column if not exists bytes integer not null default 0;
alter table public.ir_agent_sources add column if not exists extracted_text text;

-- One conversation row per visitor session, upserted as the chat goes on.
alter table public.ir_agent_conversations add column if not exists session_id text;
update public.ir_agent_conversations set session_id = id::text where session_id is null;
alter table public.ir_agent_conversations alter column session_id set not null;
create unique index if not exists ir_agent_conversations_session_idx on public.ir_agent_conversations (agent_id, session_id);
alter table public.ir_agent_conversations alter column source drop not null;
alter table public.ir_agent_conversations alter column source drop default;

-- The master template also carries the default agent name.
alter table public.ir_agent_template add column if not exists display_name text;

-- Plans that include the agent by default. Admin changes these in Feature Controls.
insert into public.ir_agent_plan_access (plan_key) values
  ('founder_basic'), ('founder_professional'), ('founder_premium'), ('founder_managed_ir')
on conflict (plan_key) do nothing;

-- Top level routes that were missing from the reserved list.
insert into public.ir_agent_reserved_slugs (slug) values ('e'), ('f'), ('r'), ('jessica2.0')
on conflict (slug) do nothing;

-- Founders see which plans include the agent (the page explains why access is off).
drop policy if exists ir_agent_plan_access_read on public.ir_agent_plan_access;
create policy ir_agent_plan_access_read on public.ir_agent_plan_access
  for select to authenticated using (true);

-- SVG logos are common. Served from a public bucket with content-type set by the
-- upload route; no inline rendering of user SVG anywhere in the app.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id = 'ir-agent-images';
