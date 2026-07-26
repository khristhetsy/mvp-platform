alter table public.event_brochures
  add column if not exists theme text not null default 'navy';

alter table public.event_brochures
  drop constraint if exists event_brochures_theme_check;

alter table public.event_brochures
  add constraint event_brochures_theme_check
  check (theme in ('navy','teal','violet','mono'));
