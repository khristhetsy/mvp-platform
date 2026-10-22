-- Phone format: store E.164 everywhere (display formatting happens in the app, src/lib/phone).
-- Conservative backfill: only rewrites values made of digits and separators. Anything with
-- letters, an extension, or an unrecognizable length is left exactly as it was.
-- Numbers with no country code and exactly 10 digits are read as US/Canada, same as the app.

create or replace function public.phone_to_e164(p text) returns text
language plpgsql immutable as $$
declare
  s text := btrim(coalesce(p, ''));
  d text;
begin
  if s = '' then return p; end if;
  if s !~ '^\+?[0-9\s().\-]+$' then return p; end if;
  d := regexp_replace(s, '\D', '', 'g');
  if left(s, 1) = '+' then
    if length(d) between 8 and 15 then return '+' || d; end if;
    return p;
  end if;
  if left(s, 2) = '00' and length(d) between 10 and 17 then return '+' || substr(d, 3); end if;
  if length(d) = 10 and d ~ '^[2-9]' then return '+1' || d; end if;
  if length(d) = 11 and d ~ '^1[2-9]' then return '+' || d; end if;
  return p;
end $$;

update public.crm_contacts
   set phone = public.phone_to_e164(phone)
 where phone is not null and phone is distinct from public.phone_to_e164(phone);

update public.crm_contacts
   set overrides = jsonb_set(overrides, '{phone2}', to_jsonb(public.phone_to_e164(overrides->>'phone2')))
 where jsonb_typeof(overrides->'phone2') = 'string'
   and overrides->>'phone2' is distinct from public.phone_to_e164(overrides->>'phone2');

update public.scheduling_bookings
   set booker_phone = public.phone_to_e164(booker_phone)
 where booker_phone is not null and booker_phone is distinct from public.phone_to_e164(booker_phone);

update public.investor_directory
   set phone = public.phone_to_e164(phone)
 where phone is not null and phone is distinct from public.phone_to_e164(phone);
