-- Operations Hub v2 — tabbed hub additions on top of the v1 playbook console.
-- Prior playbook_* tables stand. Adds: per-admin daily checks, hub settings,
-- and advisory dismiss/snooze state. Admin-gated via profiles.role like the rest.

-- 1) Per-admin, per-day "today's run" check-off. Reset is implicit (read today only).
create table if not exists public.playbook_daily_checks (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  surface_id  uuid not null references public.playbook_module(id) on delete cascade,
  checked_on  date not null,
  checked_at  timestamptz not null default now(),
  unique (admin_id, surface_id, checked_on)
);
create index if not exists idx_playbook_daily_checks_admin_day on public.playbook_daily_checks (admin_id, checked_on);

-- 2) Single-row hub settings (hub-wide).
create table if not exists public.ops_hub_settings (
  id                       int primary key default 1 check (id = 1),
  drift_detection          boolean not null default true,
  drift_auto_add           boolean not null default false,
  advisory_enabled         boolean not null default true,
  run_reset_tz             text not null default 'Europe/Paris',
  escalation_past_due_days int not null default 21,
  playbook_edit_scope      text not null default 'all_admins' check (playbook_edit_scope in ('all_admins','owner_only')),
  updated_at               timestamptz not null default now()
);
insert into public.ops_hub_settings (id) values (1) on conflict (id) do nothing;

-- 3) Advisory dismiss/snooze state (suggestions themselves are computed, not stored).
create table if not exists public.ops_advisory_actions (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references auth.users(id) on delete cascade,
  suggestion_key text not null,
  action         text not null check (action in ('dismissed','snoozed')),
  snooze_until   timestamptz,
  created_at     timestamptz not null default now(),
  unique (admin_id, suggestion_key)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.playbook_daily_checks enable row level security;
alter table public.ops_hub_settings      enable row level security;
alter table public.ops_advisory_actions  enable row level security;

-- Daily checks: an admin/analyst manages only their own rows.
create policy pb_daily_own on public.playbook_daily_checks for all to authenticated
  using (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

-- Hub settings: admin/analyst read; admin write (finer scope enforced in the API).
create policy ops_hub_settings_read on public.ops_hub_settings for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
create policy ops_hub_settings_write on public.ops_hub_settings for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Advisory actions: an admin manages only their own rows.
create policy ops_advisory_own on public.ops_advisory_actions for all to authenticated
  using (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')))
  with check (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
