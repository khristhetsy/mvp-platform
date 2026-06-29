-- Migration: 20260629007_event_marketing.sql
-- iCFO Events — Marketing Hub. One row per event holding the staff-editable
-- marketing kit: SEO meta, a one-page brochure, an email invitation, and social
-- post drafts (LinkedIn / Facebook / Instagram). Staff-only; the public event
-- page reads SEO fields server-side via the service-role client.

create table if not exists public.event_marketing (
  event_id        uuid primary key references public.events(id) on delete cascade,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  brochure        jsonb not null default '{}'::jsonb,
  email_invite    jsonb not null default '{}'::jsonb,
  social          jsonb not null default '{}'::jsonb,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists event_marketing_touch on public.event_marketing;
create trigger event_marketing_touch before update on public.event_marketing
  for each row execute function public.touch_updated_at();

alter table public.event_marketing enable row level security;

-- staff only: the marketing kit is an internal authoring surface.
drop policy if exists event_marketing_staff_all on public.event_marketing;
create policy event_marketing_staff_all on public.event_marketing
  for all using (public.is_staff()) with check (public.is_staff());
