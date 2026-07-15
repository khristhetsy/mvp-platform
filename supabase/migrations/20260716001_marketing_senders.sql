-- Approved "From" addresses for marketing campaigns. A managed list so campaigns pick
-- from validated senders instead of free-typing (which risks typos or unverified
-- domains that bounce). Shape: [{ "name": "iCapOS", "email": "outreach@icapos.com" }].
-- Deliverability still requires each address's domain to be verified in Resend.

alter table public.marketing_settings
  add column if not exists senders jsonb not null default '[]'::jsonb;

-- Seed the list with the current default sender so the dropdown isn't empty.
update public.marketing_settings
set senders = jsonb_build_array(
  jsonb_build_object('name', coalesce(nullif(default_from_name, ''), 'iCapOS'),
                     'email', coalesce(nullif(default_from_email, ''), 'outreach@icapos.com'))
)
where id = 'default' and (senders is null or senders = '[]'::jsonb);
