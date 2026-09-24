-- Who registered each attendee: the person themselves, or staff (2026-09-24).
--
-- Staff add most attendees by hand (261 of 267 registrations on 2026-09-24).
-- Those are real registrations and are counted with everyone else; this
-- column lets the admin views count them separately.
--
-- Backfill: a registration with no account behind it (attendee_id is null) can
-- only have come from the staff form, so it is 'staff'. Rows with an account
-- are 'self'. A staff registration that matched an existing account by email
-- cannot be told apart after the fact and backfills as 'self'; from this
-- release on, the staff form records 'staff' for every row it creates.

alter table public.registrations
  add column if not exists registered_by text not null default 'self';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'registrations_registered_by_check'
  ) then
    alter table public.registrations
      add constraint registrations_registered_by_check check (registered_by in ('self', 'staff'));
  end if;
end $$;

update public.registrations
set registered_by = 'staff'
where attendee_id is null and registered_by <> 'staff';

comment on column public.registrations.registered_by is
  'self: the attendee registered through the event form. staff: added from the admin registrations board.';

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select registered_by, count(*) from public.registrations group by 1;
-- Expected on 2026-09-24: staff 261, self 6.
