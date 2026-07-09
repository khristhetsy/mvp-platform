-- Security fix (audit C1): publish_items and publish_events shipped WITHOUT row
-- level security. Every public-schema table without RLS is readable/writable by
-- the `anon` and `authenticated` roles via PostgREST using the public anon key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY, shipped to every browser). publish_events holds
-- contact emails + engagement, so this was a PII-exposure hole.
--
-- App code touches these tables only via the service-role client, which BYPASSES
-- RLS — so enabling RLS with a staff-only policy closes the hole without changing
-- any application behavior. Mirrors the marketing_webhook_log pattern.

alter table public.publish_items  enable row level security;
alter table public.publish_events enable row level security;

drop policy if exists publish_items_staff on public.publish_items;
create policy publish_items_staff on public.publish_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists publish_events_staff on public.publish_events;
create policy publish_events_staff on public.publish_events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Belt-and-suspenders: strip any lingering direct table grants to the public roles.
revoke all on public.publish_items  from anon, authenticated;
revoke all on public.publish_events from anon, authenticated;
