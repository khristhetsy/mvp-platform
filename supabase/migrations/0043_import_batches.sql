-- Admin import batch tracking (staff-only via service role + RLS).

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  import_type text not null,
  file_name text not null,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'validated', 'completed', 'failed', 'canceled')
  ),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  created_rows integer not null default 0,
  updated_rows integer not null default 0,
  skipped_rows integer not null default 0,
  failed_rows integer not null default 0,
  mapping jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists import_batches_uploaded_by_idx on public.import_batches (uploaded_by);
create index if not exists import_batches_status_idx on public.import_batches (status);
create index if not exists import_batches_created_at_idx on public.import_batches (created_at desc);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  status text not null check (
    status in ('valid', 'warning', 'error', 'skipped', 'created', 'updated', 'failed')
  ),
  errors jsonb,
  warnings jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb,
  created_entity_type text,
  created_entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists import_batch_rows_batch_idx on public.import_batch_rows (batch_id);
create index if not exists import_batch_rows_row_number_idx on public.import_batch_rows (batch_id, row_number);

alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;

drop policy if exists "import_batches_select_staff" on public.import_batches;
create policy "import_batches_select_staff"
  on public.import_batches for select to authenticated
  using (public.is_staff());

drop policy if exists "import_batch_rows_select_staff" on public.import_batch_rows;
create policy "import_batch_rows_select_staff"
  on public.import_batch_rows for select to authenticated
  using (public.is_staff());
