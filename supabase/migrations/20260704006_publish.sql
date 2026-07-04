-- Prospect Pipeline — Step 5: channel-generic publish schema. Email only for now;
-- social/aeo slot in later with no migration. publish_events feeds the
-- deliverability gate and Performance funnel.

create table if not exists public.publish_items (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','social','aeo')),
  title text not null,
  body jsonb not null,                     -- {subject, html, text}
  segment text check (segment in ('hot','warm','cold')),
  wave text,
  batch int,
  status text not null default 'draft'
    check (status in ('draft','lint_flagged','ready','scheduled','sent','blocked')),
  lint_result jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  approved_by uuid references public.profiles(id),
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts(id),
  publish_id uuid references public.publish_items(id) on delete cascade,
  email text,
  resend_id text,                          -- to match provider webhooks back
  event text check (event in ('sent','delivered','open','click','signup','unsub','bounce')),
  occurred_at timestamptz not null default now()
);

create index if not exists idx_publish_events_publish on public.publish_events (publish_id);
create index if not exists idx_publish_events_email on public.publish_events (lower(email));
create index if not exists idx_publish_events_resend on public.publish_events (resend_id);
create index if not exists idx_publish_items_status on public.publish_items (status);
