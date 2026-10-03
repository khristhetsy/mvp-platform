-- SPV contract send (Sales Hub). Build spec: icapos_spv_contracts_build_spec.html.
-- Additive only: new tables, plus nullable tracking columns on the existing
-- e-signature envelopes. Nothing existing changes behavior.
--
-- Master Word files are stored in contract_templates.master_docx and installed
-- from the app (Sales Hub > Contracts > Install masters), not from this file.

-- Entities that sign for iCFO. Matches the masters: term sheets name
-- ICFO VENTURE GROUP, LLC; the services agreement names ICFO CAPITAL ADVISORY, LLC.
create table if not exists public.contract_entities (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  legal_name      text not null,
  short_name      text not null,
  address         text,
  signatory_name  text,
  signatory_title text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

insert into public.contract_entities (key, legal_name, short_name, address, signatory_name, signatory_title)
values
  ('venture',  'ICFO VENTURE GROUP, LLC',    'iCFO Venture Group',    '4225 Executive Square, Suite 600-#690, La Jolla, CA 92037', 'Khris Thetsy', null),
  ('advisory', 'ICFO CAPITAL ADVISORY, LLC', 'iCFO Capital Advisory', '4225 Executive Square, Suite 600-#690, La Jolla, CA 92037', 'Khris Thetsy', null)
on conflict (key) do nothing;

-- Master templates, versioned. A new upload of a master is a new row (version + 1);
-- documents keep the version they were created from.
create table if not exists public.contract_templates (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null,
  name               text not null,
  kind               text not null check (kind in ('term_sheet', 'services_agreement', 'advisory_agreement', 'nda')),
  subtype            text check (subtype in ('convertible_note', 'safe', 'series_a')),
  version            integer not null default 1,
  status             text not null default 'active' check (status in ('active', 'retired')),
  master_docx        bytea not null,
  master_filename    text not null,
  default_entity_id  uuid references public.contract_entities(id),
  entity_match       text,
  signature_anchors  jsonb not null,
  has_expiry         boolean not null default false,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (key, version)
);

create table if not exists public.contract_template_fields (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.contract_templates(id) on delete cascade,
  token         text not null check (token ~ '^[a-z0-9_]+$'),
  label         text not null,
  type          text not null check (type in ('text', 'date', 'currency', 'percent', 'multiline')),
  required      boolean not null default true,
  default_value text,
  position_ref  jsonb not null,
  sort_order    integer not null default 0,
  unique (template_id, token)
);

-- One cover email per send. The prospect's landing page is keyed by access_token.
create table if not exists public.contract_packets (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.crm_contacts(id) on delete cascade,
  access_token    text not null unique,
  recipient_name  text,
  recipient_email text not null,
  subject         text not null,
  body            text not null,
  email_draft_id  uuid references public.marketing_templates(id) on delete set null,
  attach_pdfs     boolean not null default true,
  sent_by         uuid not null references auth.users(id),
  sent_at         timestamptz not null default now(),
  delivered       boolean not null default false
);

-- The prospect scoped working copy: one row per document per version. A sent
-- version is locked; editing after send creates version + 1 with the same key.
create table if not exists public.contract_documents (
  id                   uuid primary key default gen_random_uuid(),
  document_key         uuid not null default gen_random_uuid(),
  contact_id           uuid not null references public.crm_contacts(id) on delete cascade,
  template_id          uuid not null references public.contract_templates(id),
  template_version     integer not null,
  entity_id            uuid references public.contract_entities(id),
  version              integer not null default 1,
  field_values         jsonb not null default '{}'::jsonb,
  body_edits           jsonb not null default '{"edits": {}, "inserted": []}'::jsonb,
  status               text not null default 'draft'
                         check (status in ('draft', 'sent', 'viewed', 'changes_requested', 'awaiting_countersign',
                                           'signed', 'declined', 'cancelled', 'expired')),
  locked               boolean not null default false,
  docx_path            text,
  pdf_path             text,
  page_count           integer,
  signature_request_id uuid references public.signature_requests(id) on delete set null,
  packet_id            uuid references public.contract_packets(id) on delete set null,
  countersign_fields   jsonb,
  executed_path        text,
  certificate_path     text,
  expires_at           timestamptz,
  created_by           uuid not null references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_at              timestamptz,
  archived_at          timestamptz,
  unique (document_key, version)
);

create index if not exists contract_documents_contact_idx on public.contract_documents (contact_id);
create index if not exists contract_documents_status_idx  on public.contract_documents (status) where archived_at is null;
create index if not exists contract_documents_request_idx on public.contract_documents (signature_request_id);

-- Activity trail per document: sent, delivered, opened, reminded, resent, signed,
-- countersigned, declined, changes_requested, cancelled, expired, archived, restored.
create table if not exists public.contract_events (
  id                   uuid primary key default gen_random_uuid(),
  contract_document_id uuid not null references public.contract_documents(id) on delete cascade,
  kind                 text not null,
  actor                text,
  detail               jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists contract_events_doc_idx on public.contract_events (contract_document_id, created_at);

-- Tracking on the existing envelopes (null for envelopes not sent from contracts).
alter table public.signature_requests
  add column if not exists contract_document_id uuid references public.contract_documents(id) on delete set null,
  add column if not exists open_count integer not null default 0,
  add column if not exists last_opened_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists changes_requested_at timestamptz,
  add column if not exists response_note text;

-- Atomic open counter for the signing page.
create or replace function public.contract_record_open(p_request_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.signature_requests
     set open_count = open_count + 1, last_opened_at = now()
   where id = p_request_id and contract_document_id is not null;
$$;
revoke all on function public.contract_record_open(uuid) from public, anon, authenticated;

-- RLS: staff only. Route handlers use the service role; the prospect never
-- touches these tables directly (token gated server routes only).
alter table public.contract_entities        enable row level security;
alter table public.contract_templates       enable row level security;
alter table public.contract_template_fields enable row level security;
alter table public.contract_packets         enable row level security;
alter table public.contract_documents       enable row level security;
alter table public.contract_events          enable row level security;

drop policy if exists contract_entities_staff on public.contract_entities;
create policy contract_entities_staff on public.contract_entities
  for select to authenticated using (public.is_staff());
drop policy if exists contract_templates_staff on public.contract_templates;
create policy contract_templates_staff on public.contract_templates
  for select to authenticated using (public.is_staff());
drop policy if exists contract_template_fields_staff on public.contract_template_fields;
create policy contract_template_fields_staff on public.contract_template_fields
  for select to authenticated using (public.is_staff());
drop policy if exists contract_packets_staff on public.contract_packets;
create policy contract_packets_staff on public.contract_packets
  for select to authenticated using (public.is_staff());
drop policy if exists contract_documents_staff on public.contract_documents;
create policy contract_documents_staff on public.contract_documents
  for select to authenticated using (public.is_staff());
drop policy if exists contract_events_staff on public.contract_events;
create policy contract_events_staff on public.contract_events
  for select to authenticated using (public.is_staff());

-- Private bucket for rendered Word/PDF copies, executed copies and certificates.
insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do nothing;

-- Cover email drafts live in the existing Marketing > Templates library
-- (department Sales). Allow a category so the send flow can list them.
alter table public.marketing_templates drop constraint if exists marketing_templates_category_chk;
alter table public.marketing_templates add constraint marketing_templates_category_chk
  check (category = any (array['general'::text, 'event'::text, 'spv_contract'::text]));
