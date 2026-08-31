-- Editable Partner Score pillar weights (admin-tunable). Single row keyed 'default';
-- the scorer falls back to the code defaults when absent. Staff-only (PII-adjacent
-- config). Additive + idempotent.

create table if not exists public.partner_score_weights (
  id          text primary key default 'default',
  weights     jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

alter table public.partner_score_weights enable row level security;

do $$ begin
  create policy partner_score_weights_staff on public.partner_score_weights
    for all using (public.is_staff()) with check (public.is_staff());
exception when duplicate_object then null; end $$;
