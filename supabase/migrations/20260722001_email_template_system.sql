-- Marketing Hub — MJML master/copy template system (build spec §2).
--
-- Additive: sits alongside the existing marketing_templates block editor.
-- Deliberately does NOT create email_suppressions — suppression already has a
-- single source of truth in marketing_unsubscribes, and the send layer already
-- checks it. A second suppression table would split that source, which the spec
-- itself warns against (§6, "load-bearing for compliance").

-- Master templates: imported MJML designs. Read-only from the UI; only the
-- build:emails pipeline writes them.
create table if not exists public.email_template_masters (
  id uuid primary key default gen_random_uuid(),
  -- Unique so `build:emails` can upsert idempotently (on conflict (name)).
  name text not null unique,
  description text,
  mjml_source text not null,
  compiled_html text not null,
  placeholder_schema jsonb not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaign copies: what users actually edit. Always created via "Use template";
-- a master is never mutated.
create table if not exists public.email_template_copies (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.email_template_masters(id) on delete restrict,
  name text not null,
  slot_values jsonb not null default '{}'::jsonb,
  banner_mode text not null default 'gradient' check (banner_mode in ('gradient', 'image')),
  banner_image_url text,
  footer_note text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  -- Nullable: no campaign-groups table exists in this repo yet. Wire later.
  campaign_group_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_template_copies_master_idx on public.email_template_copies (master_id);
create index if not exists email_template_copies_status_idx on public.email_template_copies (status);

-- RLS: admin-only, matching the existing Marketing Hub tables (is_admin() +
-- admin_all_* policy). Service role bypasses RLS for the build pipeline.
alter table public.email_template_masters enable row level security;
alter table public.email_template_copies enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['email_template_masters', 'email_template_copies']
  loop
    execute format('drop policy if exists "admin_all_%s" on public.%I', t, t);
    execute format(
      'create policy "admin_all_%s" on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t, t
    );
  end loop;
end;
$$;
