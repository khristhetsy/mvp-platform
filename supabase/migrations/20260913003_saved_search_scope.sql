-- Saved searches (Odoo Favorites) are now per page: contacts, opportunities, tasks, …
-- Existing rows are all from the Contacts grids, so the default keeps them where they were.
alter table public.marketing_saved_searches
  add column if not exists scope text not null default 'contacts';

create index if not exists marketing_saved_searches_scope_idx
  on public.marketing_saved_searches (scope, owner_id);
