-- Imports page row actions: archive (hide from the Active list, records stay
-- as they are) alongside rename, edit and delete. Archived imports have
-- archived_at set; restoring clears it.
alter table public.investor_directory_imports
  add column if not exists archived_at timestamptz;
