-- Sales AI agent: an agent built in the AI Agent module, assigned to a sales
-- opportunity, plus the audit-and-email drafts it prepares and the stage moves
-- it suggests after a prospect chats with it.
--
-- Design rules this migration encodes
--   * AI drafts, humans confirm. A draft is a row a person reviews and sends
--     through the existing Sales chatter send route. A stage move is a
--     suggestion row a person applies or dismisses. Nothing here mutates an
--     opportunity by itself.
--   * One agent per opportunity, chosen once (sales_ai_assignments). The agent
--     itself lives in ir_agents (the AI Agent module); this table only points at it.
--   * Chat conversations already land in ir_agent_conversations. The link back
--     to the opportunity is the chat_tag, a slug carried in the chat URL as
--     ?src=<chat_tag> and stored by the chat as the conversation source.
--
-- RLS: staff only (admin, analyst). The routes use the service role; the
-- policies keep a direct client from reading prospect drafts.

-- ---------------------------------------------------------------------------
-- 1. Which agent works this opportunity
-- ---------------------------------------------------------------------------
create table if not exists public.sales_ai_assignments (
  opportunity_id uuid primary key references public.sales_opportunities(id) on delete cascade,
  agent_id       uuid references public.ir_agents(id) on delete set null,
  chat_tag       text not null,
  updated_by     uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now(),
  constraint sales_ai_assignments_chat_tag_slug check (chat_tag ~ '^[a-z0-9][a-z0-9._-]*$')
);

create unique index if not exists sales_ai_assignments_chat_tag_key
  on public.sales_ai_assignments (chat_tag);

-- ---------------------------------------------------------------------------
-- 2. Audit and email drafts
-- ---------------------------------------------------------------------------
create table if not exists public.sales_ai_drafts (
  id                   uuid primary key default gen_random_uuid(),
  opportunity_id       uuid not null references public.sales_opportunities(id) on delete cascade,
  agent_id             uuid references public.ir_agents(id) on delete set null,
  stage_id             uuid references public.sales_stages(id) on delete set null,
  objection            text not null default 'unknown'
                         check (objection in ('value', 'money', 'timing', 'team', 'fence', 'ready', 'unknown')),
  technique            text,
  audit                jsonb not null default '{}'::jsonb,
  subject              text not null,
  body                 text not null,
  body_parts           jsonb,
  include_refund_offer boolean not null default true,
  chat_url             text,
  status               text not null default 'draft' check (status in ('draft', 'sent', 'discarded')),
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  sent_by              uuid references auth.users(id) on delete set null,
  sent_at              timestamptz
);

create index if not exists sales_ai_drafts_opp_idx
  on public.sales_ai_drafts (opportunity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Suggested stage moves
-- ---------------------------------------------------------------------------
create table if not exists public.sales_ai_stage_suggestions (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.sales_opportunities(id) on delete cascade,
  from_stage_id   uuid references public.sales_stages(id) on delete set null,
  to_stage_id     uuid not null references public.sales_stages(id) on delete cascade,
  reason          text not null,
  source          text not null,
  conversation_id uuid references public.ir_agent_conversations(id) on delete set null,
  status          text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_at      timestamptz not null default now(),
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz
);

create index if not exists sales_ai_stage_suggestions_opp_idx
  on public.sales_ai_stage_suggestions (opportunity_id, created_at desc);

-- One pending suggestion per destination stage, so a refresh never stacks duplicates.
create unique index if not exists sales_ai_stage_suggestions_pending_key
  on public.sales_ai_stage_suggestions (opportunity_id, to_stage_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 4. RLS: staff only. Roles that gain access: admin, analyst. Nobody else.
-- ---------------------------------------------------------------------------
alter table public.sales_ai_assignments        enable row level security;
alter table public.sales_ai_drafts             enable row level security;
alter table public.sales_ai_stage_suggestions  enable row level security;

drop policy if exists sales_ai_assignments_staff on public.sales_ai_assignments;
create policy sales_ai_assignments_staff on public.sales_ai_assignments
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists sales_ai_drafts_staff on public.sales_ai_drafts;
create policy sales_ai_drafts_staff on public.sales_ai_drafts
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists sales_ai_stage_suggestions_staff on public.sales_ai_stage_suggestions;
create policy sales_ai_stage_suggestions_staff on public.sales_ai_stage_suggestions
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));
