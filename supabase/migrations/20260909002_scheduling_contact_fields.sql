-- Configurable invitee contact fields on the booking form + captured company.
-- Additive and backward-compatible: existing rows get NULL (readers fall back to
-- the DEFAULT_CONTACT_FIELDS config), so current booking links behave unchanged.

-- Host's per-field config: { name:{label,required}, email:{...},
-- phone:{label,collect,required}, company:{label,collect,required} }.
alter table public.scheduling_availability
  add column if not exists contact_fields jsonb;

-- The invitee's company, captured at booking time (mirrors booker_name/email/phone).
alter table public.scheduling_bookings
  add column if not exists booker_company text;
