-- E-signature feature (single-signer). Three tables + private storage bucket.
-- Schema is intentionally split (envelope / fields / audit) so multi-signer
-- routing can be added later via a recipients table without a rewrite.
--
-- Access model:
--   * Authenticated admins (is_staff) read/write ONLY their own envelopes,
--     fields, and audit events (created_by = auth.uid()).
--   * The token-gated signing flow is mediated server-side with the service
--     role, which bypasses RLS. Anonymous clients get nothing from RLS.

-- ── Envelope ────────────────────────────────────────────────────────────────
create table if not exists public.signature_requests (
  id                uuid primary key default gen_random_uuid(),
  document_name     text not null,
  deal_label        text,
  source_format     text not null default 'pdf' check (source_format in ('pdf', 'docx')),
  source_file_path  text,
  working_file_path text not null,
  signed_file_path  text,
  page_count        int not null default 1,
  signer_name       text,
  signer_email      text,
  signer_company    text,
  status            text not null default 'draft'
                      check (status in ('draft', 'sent', 'viewed', 'signed', 'completed', 'voided')),
  -- Nullable on a draft; generated and made unique when the envelope is sent.
  access_token      text unique,
  consent_accepted  boolean not null default false,
  document_hash     text,
  created_by        uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  viewed_at         timestamptz,
  signed_at         timestamptz,
  voided_at         timestamptz
);

create index if not exists signature_requests_created_by_idx on public.signature_requests (created_by);
create index if not exists signature_requests_status_idx     on public.signature_requests (status);
create index if not exists signature_requests_token_idx      on public.signature_requests (access_token);

-- ── Fields placed on the document ───────────────────────────────────────────
create table if not exists public.signature_fields (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.signature_requests(id) on delete cascade,
  field_type  text not null check (field_type in ('signature', 'date', 'company', 'text', 'initial')),
  page        int not null default 1,
  x           numeric not null,
  y           numeric not null,
  width       numeric not null,
  height      numeric not null,
  required    boolean not null default true,
  auto_source text check (auto_source in ('signing_date', 'signer_company')),
  placeholder text,
  value       text,
  created_at  timestamptz not null default now()
);

create index if not exists signature_fields_request_idx on public.signature_fields (request_id);

-- ── Audit trail (tamper-evidence chain) ─────────────────────────────────────
create table if not exists public.signature_audit_events (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  event_type text not null
              check (event_type in ('created', 'sent', 'opened', 'consented', 'signed', 'sealed', 'voided')),
  actor      text,
  ip_address text,
  user_agent text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signature_audit_request_idx on public.signature_audit_events (request_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.signature_requests     enable row level security;
alter table public.signature_fields       enable row level security;
alter table public.signature_audit_events enable row level security;

-- Envelopes: owning staff have full CRUD; nobody else sees them.
drop policy if exists "signature_requests_owner" on public.signature_requests;
create policy "signature_requests_owner" on public.signature_requests
  for all to authenticated
  using (public.is_staff() and created_by = auth.uid())
  with check (public.is_staff() and created_by = auth.uid());

-- Fields: owned through the parent envelope.
drop policy if exists "signature_fields_owner" on public.signature_fields;
create policy "signature_fields_owner" on public.signature_fields
  for all to authenticated
  using (exists (
    select 1 from public.signature_requests r
    where r.id = request_id and public.is_staff() and r.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.signature_requests r
    where r.id = request_id and public.is_staff() and r.created_by = auth.uid()
  ));

-- Audit events: owning staff may read; writes happen server-side (service role).
drop policy if exists "signature_audit_owner_read" on public.signature_audit_events;
create policy "signature_audit_owner_read" on public.signature_audit_events
  for select to authenticated
  using (exists (
    select 1 from public.signature_requests r
    where r.id = request_id and public.is_staff() and r.created_by = auth.uid()
  ));

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Private bucket. Folders: source/ (original .docx), originals/ (working PDF),
-- signed/ (sealed PDF). All access is server-side via short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('signature-documents', 'signature-documents', false)
on conflict (id) do nothing;
