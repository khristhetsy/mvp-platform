-- Marketing Hub: contacts, lists, templates, campaigns, sequences, tracking
-- All tables are admin-only (internal use). No public RLS exposure.

-- ─── Contact lists ────────────────────────────────────────────────────────────
create table if not exists marketing_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Contacts ─────────────────────────────────────────────────────────────────
create table if not exists marketing_contacts (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  first_name   text,
  last_name    text,
  company      text,
  title        text,
  source       text,                        -- e.g. 'icfo', 'cold', 'csv_import'
  tags         text[] default '{}',
  metadata     jsonb default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists marketing_contacts_email_idx on marketing_contacts (email);
create index if not exists marketing_contacts_source_idx on marketing_contacts (source);

-- ─── List membership ──────────────────────────────────────────────────────────
create table if not exists marketing_list_contacts (
  list_id     uuid not null references marketing_lists(id) on delete cascade,
  contact_id  uuid not null references marketing_contacts(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (list_id, contact_id)
);

-- ─── Suppression / unsubscribes ───────────────────────────────────────────────
create table if not exists marketing_unsubscribes (
  email       text primary key,
  reason      text,                         -- 'user_request', 'bounce', 'spam_complaint'
  unsubscribed_at timestamptz not null default now()
);

-- ─── Email templates ──────────────────────────────────────────────────────────
create table if not exists marketing_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  subject      text not null,
  preview_text text,
  html_body    text not null,
  text_body    text,
  status       text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Broadcast campaigns ──────────────────────────────────────────────────────
create table if not exists marketing_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  list_id       uuid references marketing_lists(id),
  template_id   uuid references marketing_templates(id),
  status        text not null default 'draft'
                  check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  from_name     text not null default 'CapitalOS',
  from_email    text not null default 'outreach@mail.myicfos.com',
  reply_to      text,
  -- rolling stats (updated by webhook)
  stat_sent     int not null default 0,
  stat_delivered int not null default 0,
  stat_opened   int not null default 0,
  stat_clicked  int not null default 0,
  stat_replied  int not null default 0,
  stat_bounced  int not null default 0,
  stat_spam     int not null default 0,
  stat_unsubscribed int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Sequences ────────────────────────────────────────────────────────────────
create table if not exists marketing_sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists marketing_sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references marketing_sequences(id) on delete cascade,
  step_order   int not null,
  template_id  uuid references marketing_templates(id),
  delay_days   int not null default 0,
  -- condition to send: 'always', 'no_open', 'no_click', 'no_reply'
  condition    text not null default 'always'
                 check (condition in ('always', 'no_open', 'no_click', 'no_reply')),
  from_name    text not null default 'CapitalOS',
  from_email   text not null default 'outreach@mail.myicfos.com',
  created_at   timestamptz not null default now(),
  unique (sequence_id, step_order)
);

-- ─── Sequence enrollments ─────────────────────────────────────────────────────
create table if not exists marketing_sequence_enrollments (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references marketing_sequences(id) on delete cascade,
  contact_id    uuid not null references marketing_contacts(id) on delete cascade,
  current_step  int not null default 1,
  status        text not null default 'active'
                  check (status in ('active', 'completed', 'unsubscribed', 'bounced')),
  enrolled_at   timestamptz not null default now(),
  next_send_at  timestamptz,
  unique (sequence_id, contact_id)
);

create index if not exists marketing_enrollments_next_send_idx
  on marketing_sequence_enrollments (next_send_at)
  where status = 'active';

-- ─── Email send log + event tracking ─────────────────────────────────────────
create table if not exists marketing_events (
  id            uuid primary key default gen_random_uuid(),
  -- source: either a campaign or a sequence step send
  campaign_id   uuid references marketing_campaigns(id) on delete set null,
  sequence_id   uuid references marketing_sequences(id) on delete set null,
  step_id       uuid references marketing_sequence_steps(id) on delete set null,
  contact_id    uuid not null references marketing_contacts(id) on delete cascade,
  email         text not null,
  -- Resend message id
  resend_id     text unique,
  -- event type: sent, delivered, opened, clicked, bounced, spam_complaint, unsubscribed
  event_type    text not null,
  metadata      jsonb default '{}',           -- link clicked, user-agent, etc.
  occurred_at   timestamptz not null default now()
);

create index if not exists marketing_events_contact_idx on marketing_events (contact_id);
create index if not exists marketing_events_campaign_idx on marketing_events (campaign_id);
create index if not exists marketing_events_resend_idx on marketing_events (resend_id);
create index if not exists marketing_events_type_idx on marketing_events (event_type);

-- ─── RLS: all tables admin-only ───────────────────────────────────────────────
alter table marketing_lists                  enable row level security;
alter table marketing_contacts               enable row level security;
alter table marketing_list_contacts          enable row level security;
alter table marketing_unsubscribes           enable row level security;
alter table marketing_templates              enable row level security;
alter table marketing_campaigns              enable row level security;
alter table marketing_sequences              enable row level security;
alter table marketing_sequence_steps         enable row level security;
alter table marketing_sequence_enrollments   enable row level security;
alter table marketing_events                 enable row level security;

-- Helper: is current user an admin?
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1
    from public.internal_user_roles ur
    join public.internal_roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = 'admin'
      and ur.is_active = true
  )
$$;

-- Apply admin-only policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'marketing_lists',
    'marketing_contacts',
    'marketing_list_contacts',
    'marketing_unsubscribes',
    'marketing_templates',
    'marketing_campaigns',
    'marketing_sequences',
    'marketing_sequence_steps',
    'marketing_sequence_enrollments',
    'marketing_events'
  ]
  loop
    execute format(
      'create policy "admin_all_%s" on %I for all using (is_admin()) with check (is_admin())',
      t, t
    );
  end loop;
end;
$$;

-- Service role bypass for webhook + background jobs
-- (service role ignores RLS by default in Supabase — no extra policy needed)
