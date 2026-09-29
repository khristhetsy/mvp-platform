-- Patch queue: tested changes waiting to be pushed to main by the
-- apply-patch-queue GitHub Action. Private: RLS on with no policies, and no
-- grants to anon or authenticated, so only the two functions below (which
-- check the queue key) and the service role can touch it.

create table if not exists public.dev_patch_queue (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  title text not null,
  patch text not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  result text,
  applied_sha text,
  applied_at timestamptz
);

create index if not exists dev_patch_queue_pending_idx on public.dev_patch_queue (id) where status = 'pending';

alter table public.dev_patch_queue enable row level security;
revoke all on public.dev_patch_queue from anon, authenticated;
revoke all on sequence public.dev_patch_queue_id_seq from anon, authenticated;

-- sha256 of the key held in the repo's DEV_PATCH_KEY GitHub secret.
create or replace function public.dev_patch_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') = '1cb457ee06d5a364e56bad16594b3271751ec1ca0a9b09335c14e611a5fde37f';
$$;
revoke all on function public.dev_patch_key_ok(text) from public, anon, authenticated;

create or replace function public.dev_patch_pending(p_key text)
returns table (id bigint, title text, patch text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dev_patch_key_ok(p_key) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select q.id, q.title, q.patch from public.dev_patch_queue q where q.status = 'pending' order by q.id;
end;
$$;

create or replace function public.dev_patch_report(p_key text, p_id bigint, p_status text, p_result text, p_sha text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.dev_patch_key_ok(p_key) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('applied', 'failed') then
    raise exception 'bad status';
  end if;
  update public.dev_patch_queue
     set status = p_status, result = left(p_result, 4000), applied_sha = p_sha, applied_at = now()
   where id = p_id and status = 'pending';
end;
$$;

-- Callable over the REST API with the public anon key; the queue key inside is
-- what authorizes the call.
revoke all on function public.dev_patch_pending(text) from public;
revoke all on function public.dev_patch_report(text, bigint, text, text, text) from public;
grant execute on function public.dev_patch_pending(text) to anon;
grant execute on function public.dev_patch_report(text, bigint, text, text, text) to anon;
