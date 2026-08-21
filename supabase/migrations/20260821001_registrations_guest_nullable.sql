-- Allow admin "Register a guest" for people without a user account: make the
-- registration's attendee_id optional. Postgres allows multiple NULLs under the
-- existing unique(event_id, attendee_id), so guest rows don't conflict. Guest
-- name/email/phone are stored in the answers JSON (same as self-registrations).

alter table public.registrations
  alter column attendee_id drop not null;
