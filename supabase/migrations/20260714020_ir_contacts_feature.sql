-- Add a "Contacts" feature row to the Investor Relations hub in the Feature Controls
-- catalog, pointing at the universal contacts list. (Contacts is also a universal
-- top-level nav item; this just surfaces it in the IR department group.)

insert into public.features (key, label, hub_key, path, sort_order)
values ('ir_contacts', 'Contacts', 'investor_relations', '/admin/sales/contacts', 5)
on conflict (key) do nothing;
