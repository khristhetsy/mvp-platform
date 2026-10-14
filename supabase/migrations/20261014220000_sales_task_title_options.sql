-- Task title options: the ready made titles offered in the Task title field on a
-- contact's Tasks tab. Shared by the whole sales team. Idempotent.
create table if not exists public.sales_task_title_options (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'Call',
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One option per title, ignoring capital letters.
create unique index if not exists sales_task_title_options_title_idx
  on public.sales_task_title_options (lower(title));

-- Only the server reads and writes this table (service role).
alter table public.sales_task_title_options enable row level security;

insert into public.sales_task_title_options (title, task_type, sort_order) values
  ('Need to send the proposal', 'Proposal', 10),
  ('Need to resend the proposal', 'Proposal', 20),
  ('Need to revise the proposal', 'Proposal', 30),
  ('Schedule a follow-up call', 'Call', 10),
  ('Schedule a call to follow up on the proposal', 'Call', 20),
  ('Schedule a call to reschedule a meeting', 'Call', 30),
  ('Schedule a call to discuss the decision', 'Call', 40),
  ('Send a follow-up email on the proposal', 'Email', 10),
  ('Send a follow-up email on the decision', 'Email', 20)
on conflict do nothing;
