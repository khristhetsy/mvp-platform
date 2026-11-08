-- LinkedIn outreach, Step 2: the sender key and heartbeat for the local sender.
-- The sender runs on the account owner's own computer, signs in to LinkedIn there, and talks
-- to iCapOS with a key. Only a hash of the key is stored. No LinkedIn password or session
-- ever reaches iCapOS.

alter table public.linkedin_accounts add column if not exists worker_key_hash text;
alter table public.linkedin_accounts add column if not exists sender_key_set boolean not null default false;
alter table public.linkedin_accounts add column if not exists worker_last_seen_at timestamptz;

create unique index if not exists linkedin_accounts_worker_key_idx
  on public.linkedin_accounts (worker_key_hash) where worker_key_hash is not null;
