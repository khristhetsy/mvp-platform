-- In-progress voice calls, for the Command Center "Live now" monitor. A row is
-- upserted by the runtime's status-update webhook (ringing → talking →
-- transferring) and removed when the call-end webhook fires. Ephemeral by
-- design: the durable record is call_attempts. Same RLS discipline as the rest
-- of the voice subsystem — staff read, service-role write.
--
-- Apply on staging, verify, then production (migrations need human approval).

create table if not exists public.voice_live_calls (
  call_id       text primary key,               -- runtime (Vapi) call id
  contact_id    text,
  campaign_id   uuid references public.voice_campaigns(id) on delete set null,
  variant_id    uuid references public.campaign_variants(id) on delete set null,
  contact_name  text,
  company       text,
  variant_label text,
  status        text not null default 'ringing'
    check (status in ('ringing', 'talking', 'transferring', 'ending')),
  ai_disclosed  boolean not null default false,
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists voice_live_calls_started_idx on public.voice_live_calls (started_at desc);

alter table public.voice_live_calls enable row level security;

drop policy if exists voice_live_calls_staff_read on public.voice_live_calls;
create policy voice_live_calls_staff_read on public.voice_live_calls
  for select using (public.is_staff());
-- No insert/update/delete policies → only the service role writes.
