-- Social Hub: several connected accounts (one per staff member), each with a label,
-- an assignee and an optional "default for new posts" flag; plus one-time connect
-- invites so a staff member can authorize their own LinkedIn from their own machine.

alter table public.social_accounts
  add column if not exists label           text,
  add column if not exists assigned_to     uuid references public.profiles(id) on delete set null,
  add column if not exists is_default      boolean not null default false,
  add column if not exists connected_by    uuid references public.profiles(id) on delete set null,
  add column if not exists disconnected_at timestamptz;

-- At most one default account.
create unique index if not exists social_accounts_one_default
  on public.social_accounts (is_default) where is_default;

create index if not exists social_accounts_assigned_to_idx on public.social_accounts (assigned_to);

create table if not exists public.social_connect_invites (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,                    -- sha256 of the link token; the token itself is only in the email
  platform    text not null default 'linkedin' check (platform in ('linkedin', 'facebook')),
  label       text,
  assigned_to uuid references public.profiles(id) on delete set null,
  email       text not null,
  is_default  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  account_id  uuid references public.social_accounts(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists social_connect_invites_open_idx
  on public.social_connect_invites (expires_at) where used_at is null;

alter table public.social_connect_invites enable row level security;
-- Service role only (no policies): every read/write goes through the admin API.
