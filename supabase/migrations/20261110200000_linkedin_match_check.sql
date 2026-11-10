-- One "how many of my connections match these filters" count per account, asked for on the New campaign form.
alter table public.linkedin_accounts add column if not exists match_check jsonb;
