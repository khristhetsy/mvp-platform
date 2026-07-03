-- Internal CRM annotations layered on top of the read-only Odoo mirror.
-- Keyed by (source, external_id) so they survive every re-import/sync of
-- crm_contacts. PII-adjacent → RLS enabled with NO policies (service-role only;
-- the admin API gates on requireRole(['admin','analyst'])).

create table if not exists public.crm_contact_annotations (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  external_id   text not null,
  owner         text,                       -- internal owner override (name/initials)
  status        text,                       -- internal pipeline status
  tags          text[] not null default '{}',
  notes         text,                       -- private internal notes
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists crm_contact_annotations_source_ext_idx
  on public.crm_contact_annotations (source, external_id);

alter table public.crm_contact_annotations enable row level security;
-- No policies: only the service-role client (admin API) can read/write.
