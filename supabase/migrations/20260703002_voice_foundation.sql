-- iCapOS Voice — Step 1: compliance foundation (consent + DNC + queue + gate).
-- Dormant by design: no dialing code exists yet, and the queue is empty until
-- consent rows are captured. Consent-closed by default — no live consent row =
-- blocked. All tables are RLS-enabled with NO policies (service-role only); the
-- admin API gates on requireRole. Migrations require human approval.

-- ── Consent (the legal spine) ────────────────────────────────────────────────
create table if not exists public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  contact_id    text not null,                 -- Odoo external_id (crm_contacts.external_id)
  phone         text,
  channel       text not null check (channel in ('voice','sms','whatsapp')),
  consent_type  text not null check (consent_type in ('express','express_written')),
  source        text,                          -- where/how consent was captured
  jurisdiction  text,                          -- e.g. 'US', 'US-CA', 'EU', 'FR'
  call_timezone text,                          -- IANA tz for recipient-local hours
  captured_at   timestamptz not null default now(),
  expires_at    timestamptz,                   -- null = no expiry
  evidence_url  text,
  revoked_at    timestamptz,                   -- opt-out revokes here
  created_at    timestamptz not null default now()
);
create index if not exists consent_records_contact_channel_idx on public.consent_records (contact_id, channel);

-- ── Do-not-call (opt-outs land here instantly) ───────────────────────────────
create table if not exists public.dnc_list (
  id        uuid primary key default gen_random_uuid(),
  number    text not null,
  scope     text not null default 'all' check (scope in ('all','voice','sms','whatsapp')),
  reason    text,
  added_at  timestamptz not null default now(),
  unique (number, scope)
);

-- ── Campaigns + A/B variants (scripts editable + versioned) ───────────────────
create table if not exists public.voice_campaigns (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  audience                 text not null check (audience in ('founder','investor')),
  status                   text not null default 'draft' check (status in ('draft','active','paused','archived')),
  guardrail_prompt_version text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.campaign_variants (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.voice_campaigns(id) on delete cascade,
  label          text not null,
  opener_script  text,
  cadence_config jsonb not null default '{}'::jsonb,
  traffic_weight int not null default 100,
  created_at     timestamptz not null default now()
);
create index if not exists campaign_variants_campaign_idx on public.campaign_variants (campaign_id);

-- ── Call attempts (enforces the two-call cap) ────────────────────────────────
create table if not exists public.call_attempts (
  id             uuid primary key default gen_random_uuid(),
  contact_id     text not null,
  campaign_id    uuid references public.voice_campaigns(id) on delete set null,
  variant_id     uuid references public.campaign_variants(id) on delete set null,
  attempt_no     int not null default 1,
  status         text,
  disposition    text,
  ai_disclosed_at timestamptz,
  duration       int,
  transferred_to text,
  booked         boolean not null default false,
  transcript_url text,
  recording_url  text,
  cost           numeric,
  created_at     timestamptz not null default now()
);
create index if not exists call_attempts_contact_idx on public.call_attempts (contact_id);

-- ── Unified multichannel touch log (voice/SMS/WhatsApp share one cadence) ─────
create table if not exists public.outreach_touches (
  id          uuid primary key default gen_random_uuid(),
  contact_id  text not null,
  channel     text not null check (channel in ('voice','sms','whatsapp')),
  direction   text not null default 'outbound' check (direction in ('outbound','inbound')),
  campaign_id uuid references public.voice_campaigns(id) on delete set null,
  summary     text,
  occurred_at timestamptz not null default now()
);
create index if not exists outreach_touches_contact_idx on public.outreach_touches (contact_id);

-- ── Eligibility VIEW: dialable-now contacts ──────────────────────────────────
-- Consent live + phone present + not on DNC + recipient-local 8am–9pm +
-- jurisdiction allowed + attempt_no < 2. Empty until consent rows exist.
create or replace view public.v_call_queue as
select
  c.external_id                                                       as contact_id,
  c.name,
  coalesce(nullif(c.raw->>'phone',''), nullif(c.raw->>'mobile',''))   as phone,
  c.module,
  cr.jurisdiction,
  cr.call_timezone
from public.crm_contacts c
join public.consent_records cr
  on cr.contact_id = c.external_id and cr.channel = 'voice'
where c.source = 'odoo'
  and cr.revoked_at is null
  and (cr.expires_at is null or cr.expires_at > now())
  and coalesce(nullif(c.raw->>'phone',''), nullif(c.raw->>'mobile','')) is not null
  and cr.call_timezone is not null
  and (now() at time zone cr.call_timezone)::time between time '08:00' and time '21:00'
  and coalesce(cr.jurisdiction,'') not in ('EU','FR')
  and not exists (
    select 1 from public.dnc_list d
    where d.number = coalesce(nullif(c.raw->>'phone',''), nullif(c.raw->>'mobile',''))
      and d.scope in ('all','voice')
  )
  and (select count(*) from public.call_attempts a where a.contact_id = c.external_id) < 2;

-- ── pre_dial_gate(): authoritative per-dial check ────────────────────────────
-- Returns { eligible, reason, disclosure?, phone? }. SECURITY DEFINER so it can
-- read RLS-locked tables; the app calls it with the service-role client.
create or replace function public.pre_dial_gate(p_contact_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone   text;
  v_consent public.consent_records%rowtype;
  v_attempts int;
  v_disclosure text := 'This is an automated AI assistant calling on behalf of iCFO Capital. This call may be recorded.';
begin
  select coalesce(nullif(raw->>'phone',''), nullif(raw->>'mobile',''))
    into v_phone
    from public.crm_contacts where source = 'odoo' and external_id = p_contact_id;
  if v_phone is null then
    return jsonb_build_object('eligible', false, 'reason', 'no_phone');
  end if;

  select * into v_consent from public.consent_records
    where contact_id = p_contact_id and channel = 'voice' and revoked_at is null
      and (expires_at is null or expires_at > now())
    order by captured_at desc limit 1;
  if v_consent.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'no_consent');
  end if;

  if coalesce(v_consent.jurisdiction,'') in ('EU','FR') then
    return jsonb_build_object('eligible', false, 'reason', 'jurisdiction_blocked');
  end if;

  if exists (select 1 from public.dnc_list where number = v_phone and scope in ('all','voice')) then
    return jsonb_build_object('eligible', false, 'reason', 'dnc');
  end if;

  select count(*) into v_attempts from public.call_attempts where contact_id = p_contact_id;
  if v_attempts >= 2 then
    return jsonb_build_object('eligible', false, 'reason', 'attempt_cap');
  end if;

  if v_consent.call_timezone is null then
    return jsonb_build_object('eligible', false, 'reason', 'no_timezone');
  end if;
  if (now() at time zone v_consent.call_timezone)::time not between time '08:00' and time '21:00' then
    return jsonb_build_object('eligible', false, 'reason', 'outside_hours');
  end if;

  return jsonb_build_object('eligible', true, 'reason', 'ok', 'phone', v_phone, 'disclosure', v_disclosure);
end;
$$;

-- ── RLS: service-role only (no policies) ─────────────────────────────────────
alter table public.consent_records   enable row level security;
alter table public.dnc_list           enable row level security;
alter table public.voice_campaigns    enable row level security;
alter table public.campaign_variants  enable row level security;
alter table public.call_attempts      enable row level security;
alter table public.outreach_touches   enable row level security;
