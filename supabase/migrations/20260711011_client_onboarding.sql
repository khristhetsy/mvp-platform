-- Weekly Meeting System — client onboarding checklist (spec §2.4).
-- Per-company collateral checklist (headshot, logo, bio, ...). When every item is done
-- the company is marked conference_ready (feeds the booth list). conference_ready is set
-- in the app layer on item toggle, consistent with the rest of the meeting system.

create table if not exists public.ceo_client_onboarding (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid,
  company_name     text not null,
  added_on         date not null default current_date,
  conference_ready boolean not null default false,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

create table if not exists public.ceo_client_onboarding_items (
  onboarding_id  uuid not null references public.ceo_client_onboarding(id) on delete cascade,
  item_key       text not null,   -- headshot|logo|bio|summary|pitch_video|booklet|reg_form|booth|vimeo|newsletter|banner
  done           boolean not null default false,
  done_at        timestamptz,
  primary key (onboarding_id, item_key)
);

alter table public.ceo_client_onboarding enable row level security;
alter table public.ceo_client_onboarding_items enable row level security;

drop policy if exists ceo_client_onboarding_staff on public.ceo_client_onboarding;
create policy ceo_client_onboarding_staff on public.ceo_client_onboarding
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_client_onboarding_items_staff on public.ceo_client_onboarding_items;
create policy ceo_client_onboarding_items_staff on public.ceo_client_onboarding_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_client_onboarding to service_role;
grant select, insert, update, delete on public.ceo_client_onboarding_items to service_role;
