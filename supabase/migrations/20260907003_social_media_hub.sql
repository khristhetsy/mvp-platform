-- Social Media Hub — Phase 3 foundation (build-spec §9). LinkedIn first, but the
-- schema is platform-agnostic behind the adapter so Facebook / a unified API can
-- swap in without touching the queue.
--
-- Three tables:
--   social_accounts  — a connected profile/page + its OAuth tokens
--   social_posts     — one authored post (approved before publish; v1 rule)
--   social_variants  — the per-account rendition = the QUEUE unit (unique idempotency_key)

create table if not exists public.social_accounts (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null default 'linkedin',
  external_member_id text,                 -- LinkedIn member/org URN
  display_name       text,
  access_token       text,
  refresh_token      text,
  token_expires_at   timestamptz,
  status             text not null default 'connected'
    check (status in ('connected', 'expiring', 'expired', 'disconnected')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (platform, external_member_id)
);

create table if not exists public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  title        text,
  body         text not null,
  comment_text text,                        -- first comment carries the tagged link (never the body)
  link_url     text,
  status       text not null default 'draft'
    check (status in ('draft', 'approved', 'scheduled', 'published', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.social_variants (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.social_posts(id) on delete cascade,
  account_id      uuid not null references public.social_accounts(id) on delete cascade,
  body            text not null,            -- rewritten per account (v1 rule)
  comment_text    text,
  status          text not null default 'queued'
    check (status in ('queued', 'publishing', 'published', 'failed', 'skipped')),
  idempotency_key text not null unique,     -- one publish per variant, ever
  external_id     text,                     -- post URN from x-restli-id
  url             text,
  attempts        integer not null default 0,
  next_attempt_at timestamptz,
  error           text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists social_variants_due_idx
  on public.social_variants (next_attempt_at)
  where status = 'queued';
