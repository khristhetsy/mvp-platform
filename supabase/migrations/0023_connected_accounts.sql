-- Google (and future provider) OAuth connections — encrypted tokens, server-side use only.

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_user_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refresh_at timestamptz,
  unique (user_id, provider)
);

create index if not exists connected_accounts_user_id_idx on public.connected_accounts (user_id);
create index if not exists connected_accounts_provider_idx on public.connected_accounts (provider);

alter table public.connected_accounts enable row level security;

drop policy if exists "connected_accounts_select_own" on public.connected_accounts;
create policy "connected_accounts_select_own"
  on public.connected_accounts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "connected_accounts_delete_own" on public.connected_accounts;
create policy "connected_accounts_delete_own"
  on public.connected_accounts for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "connected_accounts_select_staff" on public.connected_accounts;
create policy "connected_accounts_select_staff"
  on public.connected_accounts for select to authenticated
  using (public.is_staff());

-- Inserts/updates with tokens are performed via service role in OAuth callback only.
