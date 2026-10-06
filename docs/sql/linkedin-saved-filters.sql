-- Two shared favorites on Contacts for LinkedIn imports (data only, no schema change).
-- Owner: kthetsy@myicfos.com. Shared, so every staff member sees them under Favorites.
insert into public.marketing_saved_searches (owner_id, scope, name, spec, is_default, is_shared)
select p.id, 'contacts', f.name, f.spec::jsonb, false, true
from public.profiles p
cross join (values
  ('LinkedIn without email', '{"match":"all","conditions":[{"field":"leadSource","op":"in","value":["LinkedIn"]},{"field":"email","op":"not_set"}]}'),
  ('LinkedIn with email',    '{"match":"all","conditions":[{"field":"leadSource","op":"in","value":["LinkedIn"]},{"field":"email","op":"set"}]}')
) as f(name, spec)
where p.email = 'kthetsy@myicfos.com'
  and not exists (select 1 from public.marketing_saved_searches s where s.scope = 'contacts' and s.name = f.name);
