-- Audit + undo log for merged duplicate crm_contacts (applied to production 2026-09-30).
create table if not exists public.contact_merges (
  id uuid primary key default gen_random_uuid(),
  kept_id uuid not null,
  merged_id uuid not null,
  merged_row jsonb not null,
  kept_before jsonb,
  moved jsonb not null default '{}'::jsonb,
  reason text,
  merged_by uuid,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contact_merges_kept_idx on public.contact_merges(kept_id);
create index if not exists contact_merges_merged_idx on public.contact_merges(merged_id);
alter table public.contact_merges enable row level security;
comment on table public.contact_merges is 'Audit + undo log for merged duplicate crm_contacts: the removed row, the kept row before the merge, and which references moved.';
