-- Per-company, per-gate automated reminder state for Founder Progress stage gates.
-- One row per (company, gate). The nightly cron sends a gate-specific reminder to
-- the founder every 3 days while the gate is pending, auto-stops (resolved_at) once
-- the gate is met, and re-arms if the gate regresses. Reminders are on by default:
-- a pending gate with no row is treated as active and gets a row on first pass.

create table if not exists public.stage_gate_reminders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  founder_id    uuid references public.profiles(id) on delete set null,
  gate_key      text not null,
  paused        boolean not null default false,
  sends_count   integer not null default 0,
  last_sent_at  timestamptz,
  next_send_at  timestamptz,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, gate_key)
);

create index if not exists idx_sgr_company on public.stage_gate_reminders (company_id);
create index if not exists idx_sgr_due
  on public.stage_gate_reminders (next_send_at)
  where resolved_at is null and paused = false;

-- Service-role only (staff-side automation + admin API). No anon/authenticated
-- policies: RLS on with no policy denies all non-service access.
alter table public.stage_gate_reminders enable row level security;
