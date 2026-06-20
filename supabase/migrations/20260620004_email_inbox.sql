-- Platform-native email inbox (Phase 2). Additive.
--
-- Our own mailbox: outbound sent via Resend, inbound replies received on a
-- subdomain webhook and routed back to a thread by its reply_token. Owner-scoped
-- via RLS; the inbound webhook writes through the service-role client.

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  contact_email text not null,
  contact_name text,
  reply_token text not null unique,
  last_message_at timestamptz not null default now(),
  last_direction text check (last_direction in ('outbound', 'inbound')),
  unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_threads_owner_idx on public.email_threads (owner_id, last_message_at desc);
create index if not exists email_threads_token_idx on public.email_threads (reply_token);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_email text not null,
  from_name text,
  to_email text not null,
  subject text,
  body_text text,
  body_html text,
  provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_messages_thread_idx on public.email_messages (thread_id, created_at);
create index if not exists email_messages_owner_idx on public.email_messages (owner_id);

alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;

-- email_threads: owner-only
drop policy if exists "email_threads_select_own" on public.email_threads;
create policy "email_threads_select_own" on public.email_threads for select using (owner_id = auth.uid());
drop policy if exists "email_threads_insert_own" on public.email_threads;
create policy "email_threads_insert_own" on public.email_threads for insert with check (owner_id = auth.uid());
drop policy if exists "email_threads_update_own" on public.email_threads;
create policy "email_threads_update_own" on public.email_threads for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- email_messages: owner-only
drop policy if exists "email_messages_select_own" on public.email_messages;
create policy "email_messages_select_own" on public.email_messages for select using (owner_id = auth.uid());
drop policy if exists "email_messages_insert_own" on public.email_messages;
create policy "email_messages_insert_own" on public.email_messages for insert with check (owner_id = auth.uid());
