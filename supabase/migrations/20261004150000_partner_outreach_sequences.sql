-- Partner outreach sequences (Marketing Hub > Sequences > New > Partner outreach).
-- A partner sequence is a marketing_sequences row with kind = 'partner'. Its
-- offer, sender and step settings live in partner_config; its recipients live in
-- marketing_partner_enrollments (CRM contacts, not marketing list members), so the
-- existing email sequence runner and approval batches never see them.

alter table public.marketing_sequences
  add column if not exists kind text not null default 'email',
  add column if not exists partner_config jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.marketing_sequences
    add constraint marketing_sequences_kind_check check (kind in ('email', 'partner'));
exception when duplicate_object then null; end $$;

create table if not exists public.marketing_partner_enrollments (
  id             uuid primary key default gen_random_uuid(),
  sequence_id    uuid not null references public.marketing_sequences(id) on delete cascade,
  crm_contact_id uuid references public.crm_contacts(id) on delete set null,
  name           text not null,
  firm           text,
  email          text,
  phone          text,
  tier           smallint not null check (tier between 1 and 4),
  track          text not null default 'advisor'
                 check (track in ('advisor', 'professional', 'angel_group', 'accelerator', 'bank')),
  rating         text not null default 'strong' check (rating in ('strong', 'check')),
  evidence       text,
  -- Personal Day 1 email. Empty = the track's standard Day 1 email is used.
  subject        text,
  body           text,
  stage          text not null default 'enrolled'
                 check (stage in ('enrolled', 'replied', 'call_booked', 'pilot', 'signed', 'stopped')),
  stop_reason    text,
  -- Index of the next step to run (0 = Day 1 email ... 3 = Day 21 email, 4 = finished).
  current_step   smallint not null default 0,
  started_at     timestamptz,
  next_due_at    timestamptz,
  history        jsonb not null default '[]'::jsonb,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists marketing_partner_enrollments_contact_uniq
  on public.marketing_partner_enrollments (sequence_id, crm_contact_id)
  where crm_contact_id is not null;
create unique index if not exists marketing_partner_enrollments_email_uniq
  on public.marketing_partner_enrollments (sequence_id, lower(email))
  where email is not null;
create index if not exists marketing_partner_enrollments_due_idx
  on public.marketing_partner_enrollments (sequence_id, next_due_at);

-- Service role only (the admin API checks the role), same as the other marketing tables.
alter table public.marketing_partner_enrollments enable row level security;
