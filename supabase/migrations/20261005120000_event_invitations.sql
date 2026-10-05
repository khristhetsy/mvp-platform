-- Event Hub invitations (spec: "iCapOS Event Hub Invitations Build Spec", 2026-10-05).
-- Additive only: new tables, two nullable columns on registrations, and a new
-- registration field-set version. Nothing existing is renamed or dropped.

-- 1. Campaigns: which events, which audiences, what each role is offered, when to send.
create table if not exists public.event_invitation_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_ids uuid[] not null default '{}',
  -- [{ role: 'founder'|'investor'|'advisor', list_id: uuid, offers: text[], subject: text|null, intro: text|null }]
  audiences jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'paused', 'done')),
  schedule_at timestamptz,
  -- { per: 'event'|'combined', items: { <key>: { show: bool, min: int } } }
  stats_settings jsonb not null default '{}'::jsonb,
  from_name text not null default 'iCFO Capital',
  from_email text,
  created_by uuid references public.profiles(id) on delete set null,
  scheduled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. One row per person invited by a campaign. The token in the link is stored hashed.
create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.event_invitation_campaigns(id) on delete cascade,
  role text not null check (role in ('founder', 'investor', 'advisor')),
  email text not null,
  first_name text,
  company text,
  marketing_contact_id uuid,
  crm_contact_id uuid,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'done', 'stopped')),
  stopped_reason text,
  -- invitation track: 0 = nothing sent yet, then invite, day3, day7, lastcall
  steps_sent text[] not null default '{}',
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  opened_at timestamptz,
  registered_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index if not exists event_invitations_active_idx
  on public.event_invitations (campaign_id) where status = 'active';

-- 3. Every invitation and attendee email sent, so nothing goes twice.
create table if not exists public.event_invitation_sends (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.event_invitations(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete cascade,
  kind text not null,
  resend_id text,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create unique index if not exists event_invitation_sends_reg_kind_uq
  on public.event_invitation_sends (registration_id, kind) where registration_id is not null and ok;
create unique index if not exists event_invitation_sends_inv_kind_uq
  on public.event_invitation_sends (invitation_id, kind) where invitation_id is not null and registration_id is null and ok;

-- 4. Where a registration came from.
alter table public.registrations
  add column if not exists invitation_id uuid references public.event_invitations(id) on delete set null,
  add column if not exists source text not null default 'direct';

-- 5. Admin only. Server code uses the service role; no client reads these tables.
alter table public.event_invitation_campaigns enable row level security;
alter table public.event_invitations enable row level security;
alter table public.event_invitation_sends enable row level security;

-- 6. New registration field-set version: investors can ask for one on one founder
--    meetings and offer to join the talk show as a panelist. Copies the active set
--    and appends the two checkboxes, so nothing else in the form changes.
do $$
declare
  cur public.registration_field_sets%rowtype;
  n int := 2;
  v text;
begin
  select * into cur from public.registration_field_sets where is_active limit 1;
  if cur.id is null then return; end if;
  if exists (
    select 1 from jsonb_array_elements(cur.by_type -> 'investor') f where f ->> 'key' = 'oneOnOneMeetings'
  ) then return; end if;
  loop
    v := 'reg-fields-v' || n;
    exit when not exists (select 1 from public.registration_field_sets where version = v);
    n := n + 1;
  end loop;
  insert into public.registration_field_sets (version, roles, common, by_type, is_active, reason, created_by)
  values (
    v, cur.roles, cur.common,
    jsonb_set(cur.by_type, '{investor}', coalesce(cur.by_type -> 'investor', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('key', 'oneOnOneMeetings', 'kind', 'checkbox', 'label', 'Request one on one meetings with founders'),
      jsonb_build_object('key', 'talkShowPanelist', 'kind', 'checkbox', 'label', 'Join the talk show as a panelist')
    )),
    false, 'Event invitations: investor activities for one on one meetings and talk show panelist', null
  );
  update public.registration_field_sets set is_active = false where is_active;
  update public.registration_field_sets set is_active = true where version = v;
end $$;
