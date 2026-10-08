-- Send Contracts: one saved, resumable send per contact (Save draft / Resume).
-- Holds where the sender was in the flow: the step, the documents chosen, the
-- linked fields they unlinked, and the cover email. Contract values themselves
-- stay on contract_documents (autosaved there). Cleared when the send goes out.

create table if not exists public.contract_send_drafts (
  contact_id    uuid primary key references public.crm_contacts(id) on delete cascade,
  step          smallint not null default 1 check (step between 1 and 3),
  term_sheet_id uuid references public.contract_templates(id) on delete set null,
  extra_ids     uuid[] not null default '{}',
  upload_ids    uuid[] not null default '{}',
  unlinked      jsonb not null default '{}'::jsonb,
  email         jsonb,
  updated_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create index if not exists contract_send_drafts_updated_idx on public.contract_send_drafts (updated_at desc);

alter table public.contract_send_drafts enable row level security;

-- Staff read only through the client; writes go through the API (service role),
-- which applies Sales scoping per contact.
drop policy if exists contract_send_drafts_staff on public.contract_send_drafts;
create policy contract_send_drafts_staff on public.contract_send_drafts
  for select to authenticated using (public.is_staff());
