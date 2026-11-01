-- Sales AI training: what staff teach the sales AI agent's email drafts.
--
-- Three things, all staff only (admin, analyst):
--   sales_ai_settings   one row: extra banned words, the refund line, deal skip rules
--   sales_ai_documents  PDFs whose text guides the wording (text kept on the row)
--   sales_ai_examples   emails staff would send, and emails they would never send
--
-- Nothing here sends an email or changes a record. The draft still waits for a
-- person to approve it. The built-in copy rules in src/lib/sales-ai/guards.ts
-- stay on whatever is saved here: these tables can add rules, never remove them.
--
-- RLS: staff only. The routes use the service role.

create table if not exists public.sales_ai_settings (
  id           boolean primary key default true check (id),
  blocked_words text[] not null default '{}',
  refund_line  text not null default 'If your Capital Readiness Rating does not improve, we will refund your money.',
  skip_phrases text[] not null default '{}',
  skip_tags    text[] not null default '{}',
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

-- One starting row: the deal wording and tags that mean "this is not a subscription sale".
insert into public.sales_ai_settings (id, skip_phrases, skip_tags)
values (
  true,
  array['convertible note', 'bridge', 'SPV', 'term sheet', 'cap table', 'due diligence costs'],
  array['Deal', 'Capital advisory']
)
on conflict (id) do nothing;

create table if not exists public.sales_ai_documents (
  id             uuid primary key default gen_random_uuid(),
  file_name      text not null check (lower(file_name) like '%.pdf'),
  storage_path   text not null,
  bytes          integer check (bytes is null or bytes >= 0),
  purpose        text,
  status         text not null default 'processing' check (status in ('processing', 'trained', 'failed')),
  extracted_text text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists sales_ai_documents_created_idx on public.sales_ai_documents (created_at desc);

create table if not exists public.sales_ai_examples (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('send', 'never')),
  stage_name text,
  body       text not null check (char_length(body) between 20 and 3000),
  reason     text check (reason is null or char_length(reason) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sales_ai_examples_created_idx on public.sales_ai_examples (created_at desc);

alter table public.sales_ai_settings  enable row level security;
alter table public.sales_ai_documents enable row level security;
alter table public.sales_ai_examples  enable row level security;

drop policy if exists sales_ai_settings_staff on public.sales_ai_settings;
create policy sales_ai_settings_staff on public.sales_ai_settings
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists sales_ai_documents_staff on public.sales_ai_documents;
create policy sales_ai_documents_staff on public.sales_ai_documents
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists sales_ai_examples_staff on public.sales_ai_examples;
create policy sales_ai_examples_staff on public.sales_ai_examples
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));
