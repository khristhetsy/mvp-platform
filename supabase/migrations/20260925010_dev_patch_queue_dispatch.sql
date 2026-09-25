-- Start the "Apply patch queue" GitHub Action the moment a patch is queued,
-- instead of waiting for GitHub's cron (which in practice fires about every 3 hours).
--
-- Needs one Vault secret, stored by Khris, never by Claude:
--   name:  github_actions_dispatch_token
--   value: a fine-grained GitHub token, repo khristhetsy/mvp-platform only,
--          permission "Actions: Read and write", nothing else.
-- Without that secret the trigger does nothing and the cron keeps working as before.
-- pg_net sends the request asynchronously, so a queue insert never waits on GitHub.

create or replace function public.dev_patch_queue_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'github_actions_dispatch_token'
  limit 1;

  if v_token is null or v_token = '' then
    return null;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/khristhetsy/mvp-platform/actions/workflows/apply-patch-queue.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'icapos-patch-queue',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main')
  );
  return null;
exception when others then
  -- Never block queueing a patch; the cron is the fallback.
  return null;
end;
$$;

revoke all on function public.dev_patch_queue_dispatch() from public, anon, authenticated;

drop trigger if exists dev_patch_queue_dispatch on public.dev_patch_queue;
create trigger dev_patch_queue_dispatch
after insert on public.dev_patch_queue
for each statement
execute function public.dev_patch_queue_dispatch();
