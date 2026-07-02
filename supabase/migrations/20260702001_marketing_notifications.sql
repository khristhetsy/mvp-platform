-- Marketing hub — admin notification & reminder layer.
--
-- Namespaced with the `mkt_` prefix so it does NOT collide with the existing
-- platform-wide `public.notifications` table (0021), which is a different,
-- recipient-scoped feed. This feature is admin-only and lives under
-- /admin/marketing/settings/notifications.
--
-- Four tables:
--   mkt_notification_types     — code-seeded catalog (mirrors NOTIF_TYPES)
--   mkt_notification_prefs     — per-admin per-type overrides
--   mkt_notification_settings  — per-admin global controls
--   mkt_notifications          — delivered in-app feed (the bell)
--
-- Access is enforced at the API layer via requireRole(["admin"]) + service role.
-- RLS below is an owner-scoped backstop.

-- ── Catalog ──────────────────────────────────────────────────────────────────
create table if not exists public.mkt_notification_types (
  id text primary key,
  "group" text not null,
  label text not null,
  description text not null default '',
  kind text not null check (kind in ('alert','reminder')),
  default_channels jsonb not null default '[]',
  default_on boolean not null default true,
  urgent boolean not null default false,
  supports_cadence boolean not null default false,
  default_cadence text
);

-- ── Per-admin overrides (absence = catalog default) ──────────────────────────
create table if not exists public.mkt_notification_prefs (
  admin_id uuid not null references public.profiles(id) on delete cascade,
  type_id text not null references public.mkt_notification_types(id) on delete cascade,
  enabled boolean not null,
  channels jsonb not null default '[]',
  cadence text,
  updated_at timestamptz not null default now(),
  primary key (admin_id, type_id)
);

-- ── Per-admin global controls ────────────────────────────────────────────────
create table if not exists public.mkt_notification_settings (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  master_on boolean not null default true,
  quiet_hours_on boolean not null default true,
  quiet_start time not null default '21:00',
  quiet_end time not null default '07:00',
  digest_time time not null default '06:30',
  default_channels jsonb not null default '["in_app","email"]',
  timezone text not null default 'Europe/Paris',
  updated_at timestamptz not null default now()
);

-- ── Delivered in-app notifications (bell feed) ───────────────────────────────
create table if not exists public.mkt_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  type_id text not null references public.mkt_notification_types(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  meta jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text
);
create index if not exists mkt_notifications_feed_idx
  on public.mkt_notifications (admin_id, read_at, created_at desc);
create unique index if not exists mkt_notifications_dedupe_idx
  on public.mkt_notifications (admin_id, dedupe_key) where dedupe_key is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.mkt_notification_types    enable row level security;
alter table public.mkt_notification_prefs     enable row level security;
alter table public.mkt_notification_settings  enable row level security;
alter table public.mkt_notifications          enable row level security;

drop policy if exists "mkt_types_read" on public.mkt_notification_types;
create policy "mkt_types_read" on public.mkt_notification_types
  for select to authenticated using (true);

drop policy if exists "mkt_prefs_own" on public.mkt_notification_prefs;
create policy "mkt_prefs_own" on public.mkt_notification_prefs
  for all to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

drop policy if exists "mkt_settings_own" on public.mkt_notification_settings;
create policy "mkt_settings_own" on public.mkt_notification_settings
  for all to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

drop policy if exists "mkt_notifs_own" on public.mkt_notifications;
create policy "mkt_notifs_own" on public.mkt_notifications
  for all to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- ── Catalog seed (mirrors /lib/marketing/notifications/catalog.ts) ───────────
insert into public.mkt_notification_types
  (id, "group", label, description, kind, default_channels, default_on, urgent, supports_cadence, default_cadence)
values
  ('cmo.brief_ready','ai_cmo','Morning brief ready','Daily strategic brief from your AI CMO','reminder','["in_app","email"]',true,false,true,'daily_0630'),
  ('cmo.high_confidence','ai_cmo','New high-confidence recommendation','When the CMO flags something worth acting on now','alert','["in_app"]',true,false,false,null),
  ('compliance.awaiting_review','compliance','Asset awaiting your review','AI-drafted asset queued for the compliance gate','alert','["in_app","email"]',true,false,false,null),
  ('compliance.violation_flagged','compliance','Register violation flagged','AI caught outcome-register language before send','alert','["in_app"]',true,true,false,null),
  ('compliance.queue_stale','compliance','Reminder: queue not cleared','Nudge if assets sit unreviewed too long','reminder','["in_app"]',true,false,true,'after_4h'),
  ('aiseo.citation_gained','ai_seo','New citation gained','An AI platform started naming iCapOS','alert','["in_app"]',true,false,false,null),
  ('aiseo.citation_lost','ai_seo','Citation lost / competitor overtook','You dropped from an answer, or a rival took the slot','alert','["in_app","email"]',true,false,false,null),
  ('aiseo.weekly_report','ai_seo','Weekly visibility report','Share-of-model summary across tracked prompts','reminder','["email"]',true,false,true,'weekly_mon'),
  ('campaigns.batch_complete','campaigns','Batch send complete','A campaign batch finished sending','alert','["in_app"]',false,false,false,null),
  ('campaigns.deliverability_drop','campaigns','Open / deliverability drop','Performance fell below your threshold','alert','["in_app","email"]',true,true,false,null),
  ('segments.warm_idle','segments','Warm cohort going idle',E'Your warmest segment hasn\'t been worked','reminder','["in_app"]',true,false,true,'after_5d'),
  ('segments.investor_untouched','segments','Investor list untouched','Supply-side risk in the two-sided base','reminder','["in_app"]',true,false,true,'after_7d')
on conflict (id) do update set
  "group" = excluded."group",
  label = excluded.label,
  description = excluded.description,
  kind = excluded.kind,
  default_channels = excluded.default_channels,
  default_on = excluded.default_on,
  urgent = excluded.urgent,
  supports_cadence = excluded.supports_cadence,
  default_cadence = excluded.default_cadence;
