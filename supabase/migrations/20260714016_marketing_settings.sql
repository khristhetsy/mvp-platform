-- Marketing default sender: a single-row settings table so new campaigns and
-- sequences default to a configured (ideally domain-verified) From address instead
-- of a hardcoded outreach@icapos.com.

create table if not exists public.marketing_settings (
  id text primary key default 'default',
  default_from_name text not null default 'iCapOS',
  default_from_email text not null default 'outreach@icapos.com',
  default_reply_to text,
  updated_at timestamptz not null default now()
);

insert into public.marketing_settings (id) values ('default') on conflict (id) do nothing;
