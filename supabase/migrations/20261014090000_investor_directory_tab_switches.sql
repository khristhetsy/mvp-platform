-- Investor directory: which tabs founders see. All on by default, so nothing
-- changes until an admin switches one off in Admin › Investor Directory › Access.
alter table public.investor_directory_settings
  add column if not exists tab_directory boolean not null default true,
  add column if not exists tab_formd     boolean not null default true,
  add column if not exists tab_linkedin  boolean not null default true,
  add column if not exists tab_csv       boolean not null default true;
