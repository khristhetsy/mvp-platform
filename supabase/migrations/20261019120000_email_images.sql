-- Email images library: images uploaded in the platform and inserted into emails
-- composed in Sales and Marketing. Files live in the public marketing-assets bucket
-- under email/<year>/, so every link is a permanent public https URL. Idempotent.

-- The bucket already exists in production; this keeps a fresh environment working.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-assets', 'marketing-assets', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create table if not exists public.email_images (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  public_url text not null,
  mime_type text not null,
  bytes integer not null,
  width integer,
  height integer,
  alt_text text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Archive only hides an image from the picker. The file stays in storage so
  -- emails that were already sent keep showing it.
  archived_at timestamptz
);

create index if not exists email_images_active_idx
  on public.email_images (created_at desc)
  where archived_at is null;

-- Only the server reads and writes this table (service role).
alter table public.email_images enable row level security;
