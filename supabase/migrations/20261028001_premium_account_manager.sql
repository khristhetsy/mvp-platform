-- Premium, Done for you: the iCFO staff member who becomes the account manager of every
-- new Premium account. Additive and idempotent. Rollback: drop the column.
alter table public.ops_settings
  add column if not exists premium_account_manager_id uuid references public.profiles(id) on delete set null;
