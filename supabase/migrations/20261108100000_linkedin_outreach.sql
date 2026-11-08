-- LinkedIn outreach, Step 1 (admin pilot). New tables only: nothing here touches the email
-- inbox, marketing sequences or any table that already works.
-- Step 1 stores accounts, safety settings, campaigns, targets and the LinkedIn inbox rows, and
-- queues invites. It does NOT send anything to LinkedIn: the worker is Step 2.
-- Staff read and write through the admin API with the service role, so RLS is on with no
-- policies: nothing is reachable with a user's own key.

create table if not exists public.linkedin_accounts (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles(id) on delete cascade,
  label               text not null,                       -- name people see on LinkedIn
  linkedin_slug       text,
  status              text not null default 'not_connected'
                        check (status in ('not_connected', 'connected', 'paused', 'warning')),
  paused_reason       text,
  safety_level        text not null default 'standard' check (safety_level in ('careful', 'standard', 'custom')),
  custom_daily_cap    integer check (custom_daily_cap is null or custom_daily_cap between 1 and 100),
  custom_weekly_cap   integer check (custom_weekly_cap is null or custom_weekly_cap between 1 and 300),
  manual_allowance    integer not null default 5 check (manual_allowance between 0 and 50),
  high_value_tag      text,
  warm_up_started_at  timestamptz,
  timezone            text not null default 'America/Los_Angeles',
  send_on_schedule    boolean not null default true,
  handoff_enabled     boolean not null default true,
  withdraw_pending    boolean not null default true,
  weekly_summary      boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists linkedin_accounts_owner_idx on public.linkedin_accounts (owner_id);

create table if not exists public.linkedin_campaigns (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.linkedin_accounts(id) on delete cascade,
  name           text not null,
  status         text not null default 'draft'
                   check (status in ('draft', 'pending_approval', 'ready', 'running', 'paused', 'completed', 'stopped')),
  audience       jsonb not null default '{}'::jsonb,       -- { source: 'crm' | 'links' | 'file', filters... }
  invite_variants jsonb not null default '[]'::jsonb,      -- [{ id, text }], at most 5
  message_text   text,
  wording_hash   text,                                      -- hash of the wording that was approved
  approved_by    uuid references public.profiles(id),
  approved_at    timestamptz,
  handoff_mode   text not null default 'web_chat' check (handoff_mode in ('web_chat', 'linkedin')),
  agent          text not null default 'johnny' check (agent in ('johnny', 'jessica')),
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists linkedin_campaigns_account_idx on public.linkedin_campaigns (account_id, status);

create table if not exists public.linkedin_targets (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.linkedin_campaigns(id) on delete cascade,
  contact_id      uuid references public.crm_contacts(id) on delete set null,
  linkedin_slug   text,
  display_name    text,
  route           text not null default 'invite' check (route in ('invite', 'message', 'email_first', 'manual')),
  status          text not null default 'queued'
                    check (status in ('queued', 'skipped', 'invited', 'accepted', 'messaged', 'replied', 'handed_off', 'withdrawn', 'failed')),
  skip_reason     text,
  variant_id      text,
  task_id         uuid,                                      -- admin_tasks row for a hand sent invite
  next_action_at  timestamptz,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  updated_at      timestamptz not null default now()
);
create unique index if not exists linkedin_targets_campaign_contact_idx
  on public.linkedin_targets (campaign_id, contact_id) where contact_id is not null;
create index if not exists linkedin_targets_due_idx
  on public.linkedin_targets (next_action_at) where status = 'queued';
create index if not exists linkedin_targets_campaign_idx on public.linkedin_targets (campaign_id, status);

create table if not exists public.linkedin_events (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid references public.linkedin_accounts(id) on delete cascade,
  campaign_id  uuid references public.linkedin_campaigns(id) on delete cascade,
  target_id    uuid references public.linkedin_targets(id) on delete cascade,
  kind         text not null
                 check (kind in ('queued', 'invite_sent', 'accepted', 'message_sent', 'reply', 'handed_off', 'paused',
                                 'resumed', 'warning', 'withdrawn', 'approved', 'started', 'stopped', 'failed')),
  detail       text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists linkedin_events_account_idx on public.linkedin_events (account_id, created_at desc);
create index if not exists linkedin_events_campaign_idx on public.linkedin_events (campaign_id, created_at desc);

-- LinkedIn inbox rows. Filled by the worker in Step 2 and by notification emails in Step 3.
create table if not exists public.linkedin_threads (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.linkedin_accounts(id) on delete cascade,
  target_id        uuid references public.linkedin_targets(id) on delete set null,
  contact_id       uuid references public.crm_contacts(id) on delete set null,
  contact_name     text not null,
  state            text not null default 'ai_active' check (state in ('ai_active', 'human', 'closed')),
  unread           boolean not null default true,
  last_message_at  timestamptz not null default now(),
  last_preview     text,
  created_at       timestamptz not null default now()
);
create index if not exists linkedin_threads_account_idx on public.linkedin_threads (account_id, last_message_at desc);

create table if not exists public.linkedin_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.linkedin_threads(id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  body        text not null,
  source      text not null default 'worker' check (source in ('worker', 'manual', 'email', 'agent')),
  sent_at     timestamptz not null default now()
);
create index if not exists linkedin_messages_thread_idx on public.linkedin_messages (thread_id, sent_at);

alter table public.linkedin_accounts  enable row level security;
alter table public.linkedin_campaigns enable row level security;
alter table public.linkedin_targets   enable row level security;
alter table public.linkedin_events    enable row level security;
alter table public.linkedin_threads   enable row level security;
alter table public.linkedin_messages  enable row level security;
