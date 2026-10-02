-- /fit Match Review booking form: which contact fields founders fill in and any
-- extra questions. Edited in Admin › Fit funnel; read by /api/fit/booking-form.
-- Single row; service-role only (RLS on, no policy), same as sales_settings.

create table if not exists public.fit_settings (
  id text primary key default 'default',
  booking_form jsonb,
  updated_at timestamptz not null default now()
);

insert into public.fit_settings (id) values ('default') on conflict (id) do nothing;

alter table public.fit_settings enable row level security;
