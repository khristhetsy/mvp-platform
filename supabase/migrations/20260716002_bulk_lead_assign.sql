-- Mass Lead assign (super-admin only, enforced in the API). Adds member ids to the
-- assignee_ids array of many contacts in one set-based statement, and records an
-- audit row. Assignee_ids is uuid[]; the union keeps existing assignees (Add only).

-- Union p_member_ids into assignee_ids for the given contact ids; returns rows changed.
create or replace function public.sales_bulk_add_assignees(p_member_ids uuid[], p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.crm_contacts c
  set assignee_ids = (
    select array(select distinct e from unnest(coalesce(c.assignee_ids, '{}') || p_member_ids) as e)
  )
  where c.id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Audit trail for bulk assignment actions.
create table if not exists public.sales_bulk_assign_audit (
  id            bigint generated always as identity primary key,
  actor_id      uuid references auth.users(id),
  member_ids    uuid[] not null default '{}',
  contact_count integer not null default 0,
  filter        text,
  created_at    timestamptz not null default now()
);
create index if not exists sales_bulk_assign_audit_created on public.sales_bulk_assign_audit (created_at desc);
