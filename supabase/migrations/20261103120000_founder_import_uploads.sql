-- One row per investor contact upload a founder runs, so staff can see who
-- uploaded what, which columns were left out, and which rows were held back.
-- Before this, only the mapped fields were saved and the file itself was lost.
create table if not exists public.founder_import_uploads (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  file_name text not null,
  source text not null default 'csv_import',
  total_rows integer not null default 0,
  imported integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  columns jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '[]'::jsonb,
  raw_rows jsonb not null default '[]'::jsonb,
  attention_rows jsonb not null default '[]'::jsonb,
  raw_truncated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists founder_import_uploads_company_idx
  on public.founder_import_uploads (company_id, created_at desc);
create index if not exists founder_import_uploads_founder_idx
  on public.founder_import_uploads (founder_id);

-- Service role only: the raw file can hold anything the founder uploaded.
-- The API route writes it and the admin pages read it, both with the service role.
alter table public.founder_import_uploads enable row level security;
