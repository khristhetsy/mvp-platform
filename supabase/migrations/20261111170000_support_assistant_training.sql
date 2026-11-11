-- Support assistant training (Admin > Support > Train assistant).
-- Answers an admin taught the in app support assistant, and the PDFs it reads.
-- The product knowledge text and the dismissed gap list live in platform_settings
-- (keys support_assistant_brief and support_assistant_dismissed_gaps), so no table for those.

create table if not exists public.support_assistant_answers (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 200),
  answer text not null check (char_length(answer) between 2 and 600),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Training sources. PDF only, matching the platform rule for document uploads.
create table if not exists public.support_assistant_sources (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (lower(file_name) like '%.pdf'),
  storage_path text not null,
  bytes integer not null default 0,
  status text not null default 'processing' check (status in ('processing', 'trained', 'failed')),
  extracted_text text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Server only: the routes use the service role, so no policy is created and
-- authenticated users cannot read or write these tables directly.
alter table public.support_assistant_answers enable row level security;
alter table public.support_assistant_sources enable row level security;
