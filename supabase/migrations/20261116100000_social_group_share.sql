-- Social Media Hub: Group share queue (share one post to many Facebook and LinkedIn groups by hand).
-- Additive and safe to re-run. No existing table or column is changed.
-- Neither network has a group posting API, so nothing is posted from here: staff copy the text,
-- open each group and tap Post themselves. These tables only track the queue.
-- Each group has its own attribution campaign, so the existing /r/<post> redirect and /fit?s=<tag>
-- rails give per group clicks, signups and meetings with no new tracking tables.
-- Staff only (admin, analyst). Routes also check the role server side.

-- 1. Saved groups, with an owner and any posting rule.
create table if not exists public.social_groups (
  id             uuid primary key default gen_random_uuid(),
  network        text not null default 'facebook' check (network in ('facebook', 'linkedin')),
  name           text not null check (char_length(name) between 1 and 120),
  url            text not null check (char_length(url) <= 500),
  members        integer check (members is null or members >= 0),
  owner_id       uuid references public.profiles(id) on delete set null,
  rule_note      text check (rule_note is null or char_length(rule_note) <= 200),
  skip_days      smallint[] not null default '{}',
  needs_approval boolean not null default false,
  active         boolean not null default true,
  campaign_id    uuid references public.social_campaigns(id) on delete set null,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create unique index if not exists social_groups_url_uq on public.social_groups (lower(url));

-- 2. One share run: the post, link, pacing.
create table if not exists public.social_group_shares (
  id            uuid primary key default gen_random_uuid(),
  network       text not null default 'facebook' check (network in ('facebook', 'linkedin')),
  body          text not null check (char_length(body) between 1 and 5000),
  vary_opening  boolean not null default true,
  wait_minutes  smallint not null default 5 check (wait_minutes between 1 and 120),
  daily_cap     smallint not null default 10 check (daily_cap between 1 and 100),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- 3. One row per group in a run. post_id is the tracked draft post behind its /r/ link.
create table if not exists public.social_group_share_items (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references public.social_group_shares(id) on delete cascade,
  group_id    uuid not null references public.social_groups(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  position    integer not null default 0,
  text        text not null,
  post_id     uuid references public.social_posts(id) on delete set null,
  status      text not null default 'waiting' check (status in ('waiting', 'opened', 'posted', 'skipped')),
  opened_at   timestamptz,
  posted_at   timestamptz,
  removed_at  timestamptz,
  unique (share_id, group_id)
);
create index if not exists social_group_share_items_share_idx on public.social_group_share_items (share_id, position);
create index if not exists social_group_share_items_group_idx on public.social_group_share_items (group_id);

-- 4. RLS: staff only. Roles that gain access: admin, analyst. No founder or investor access.
alter table public.social_groups             enable row level security;
alter table public.social_group_shares       enable row level security;
alter table public.social_group_share_items  enable row level security;

drop policy if exists "staff_full_access" on public.social_groups;
create policy "staff_full_access" on public.social_groups
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists "staff_full_access" on public.social_group_shares;
create policy "staff_full_access" on public.social_group_shares
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists "staff_full_access" on public.social_group_share_items;
create policy "staff_full_access" on public.social_group_share_items
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));
