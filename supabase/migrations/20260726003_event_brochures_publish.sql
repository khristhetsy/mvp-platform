alter table public.event_brochures
  add column if not exists published boolean not null default false;

alter table public.event_brochures
  add column if not exists published_at timestamptz;
