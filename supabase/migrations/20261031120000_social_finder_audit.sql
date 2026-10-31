-- Social Media Hub: conversation finder and site audit.
-- Additive and safe to re-run. No existing table or column is changed.
-- Staff only (admin, analyst). Routes also check the role server side.

-- 1. Signal phrases the finder watches.
create table if not exists public.social_finder_signals (
  id          uuid primary key default gen_random_uuid(),
  phrase      text not null check (char_length(phrase) between 2 and 120),
  platform    text not null default 'any' check (platform in ('any', 'reddit', 'linkedin', 'x')),
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists social_finder_signals_phrase_uq
  on public.social_finder_signals (lower(phrase), platform);

-- 2. Conversations to review. Staff add them by pasting a link (v1). Nothing is posted from here.
create table if not exists public.social_finder_hits (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('reddit', 'linkedin', 'x')),
  thread_url    text not null check (char_length(thread_url) <= 500),
  author_handle text,
  excerpt       text not null check (char_length(excerpt) between 1 and 600),
  signal_id     uuid references public.social_finder_signals(id) on delete set null,
  audience      text not null default 'founder' check (audience in ('founder', 'investor')),
  match_level   text not null default 'good' check (match_level in ('strong', 'good', 'review')),
  status        text not null default 'new' check (status in ('new', 'replied', 'skipped', 'held')),
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create unique index if not exists social_finder_hits_thread_uq on public.social_finder_hits (thread_url);
create index if not exists social_finder_hits_status_idx on public.social_finder_hits (status, created_at desc);

-- 3. Site audit runs. Findings stay proposed until a staff member approves them.
create table if not exists public.social_site_audits (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  run_at       timestamptz not null default now(),
  findings     jsonb not null default '[]'::jsonb,
  approved_by  uuid references public.profiles(id) on delete set null,
  approved_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null
);
create index if not exists social_site_audits_run_idx on public.social_site_audits (run_at desc);

-- 4. RLS: staff only. Roles that gain access: admin, analyst. No founder or investor access.
alter table public.social_finder_signals enable row level security;
alter table public.social_finder_hits    enable row level security;
alter table public.social_site_audits    enable row level security;

drop policy if exists "staff_full_access" on public.social_finder_signals;
create policy "staff_full_access" on public.social_finder_signals
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists "staff_full_access" on public.social_finder_hits;
create policy "staff_full_access" on public.social_finder_hits
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists "staff_full_access" on public.social_site_audits;
create policy "staff_full_access" on public.social_site_audits
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));
