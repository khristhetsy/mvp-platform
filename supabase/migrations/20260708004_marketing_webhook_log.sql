-- Marketing webhook diagnostics. Records every inbound Resend/Svix webhook attempt
-- (verified or not) so the Analytics page can tell WHY tracking isn't flowing:
-- no calls at all (endpoint not set in Resend) vs calls rejected (secret mismatch)
-- vs verified-but-unmatched (send didn't record resend_id) vs recorded. Writes are
-- service-role only (the webhook); reads are staff-gated at the API layer.

create table if not exists public.marketing_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  verified boolean not null default false,
  event_type text,
  outcome text not null,
  detail text
);
create index if not exists marketing_webhook_log_received_idx
  on public.marketing_webhook_log (received_at desc);

alter table public.marketing_webhook_log enable row level security;
drop policy if exists marketing_webhook_log_staff on public.marketing_webhook_log;
create policy marketing_webhook_log_staff on public.marketing_webhook_log
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
