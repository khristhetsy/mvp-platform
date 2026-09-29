-- Founder email budget.
--
-- founder_email_prefs: how often each founder wants email (daily digest,
-- weekly summary, or instant alerts only), when, and in which time zone. A
-- founder reads and writes only their own row; the digest job uses the
-- service role.
--
-- founder_digest_items: scheduled emails held for a founder's next digest
-- instead of being sent on their own. Written and read by the service role
-- only (the email gate and the digest job), so RLS is on with a founder read
-- policy on their own rows and no client writes.
--
-- The rules themselves live in platform_settings (key founder_email_budget).
-- Nothing changes for anyone until an admin sets a rollout above 0%.

create table if not exists public.founder_email_prefs (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  mode            text not null default 'daily' check (mode in ('daily', 'weekly', 'instant')),
  send_hour       smallint check (send_hour between 0 and 23),
  timezone        text,
  skip_if_active  boolean not null default true,
  downshifted_at  timestamptz,
  downshift_from  text check (downshift_from in ('daily', 'weekly')),
  unsubscribed_at timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.founder_email_prefs enable row level security;

drop policy if exists founder_email_prefs_select_own on public.founder_email_prefs;
create policy founder_email_prefs_select_own on public.founder_email_prefs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists founder_email_prefs_insert_own on public.founder_email_prefs;
create policy founder_email_prefs_insert_own on public.founder_email_prefs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists founder_email_prefs_update_own on public.founder_email_prefs;
create policy founder_email_prefs_update_own on public.founder_email_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.founder_digest_items (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  source_job   text not null,
  subject      text not null,
  excerpt      text,
  url          text,
  status       text not null default 'pending' check (status in ('pending', 'sent', 'dropped', 'expired')),
  reason       text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists founder_digest_items_pending_idx
  on public.founder_digest_items (user_id, created_at) where status = 'pending';
create index if not exists founder_digest_items_subject_idx
  on public.founder_digest_items (user_id, subject, created_at desc);

alter table public.founder_digest_items enable row level security;

drop policy if exists founder_digest_items_select_own on public.founder_digest_items;
create policy founder_digest_items_select_own on public.founder_digest_items
  for select to authenticated using (user_id = auth.uid());
