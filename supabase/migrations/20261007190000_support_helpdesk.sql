-- Support help desk: internal notes, PDF attachments, email and chat channels.
-- Additive and safe to run before the code deploys.
--
-- Rollback:
--   drop policy if exists support_messages_select on public.support_messages;
--   create policy support_messages_select on public.support_messages for select using (is_staff() or exists (select 1 from public.support_requests r where r.id = support_messages.request_id and r.founder_id = auth.uid()));
--   alter table public.support_messages drop column if exists is_internal, drop column if exists attachments;
--   (restore support_requests_source_check without 'email', 'chat')

-- 1. Internal notes: staff-only messages on a request.
alter table public.support_messages add column if not exists is_internal boolean not null default false;

-- 2. PDF attachments on a message: [{ "path": "...", "name": "...", "size": 123 }].
alter table public.support_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Founders never read internal notes.
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select using (
    is_staff()
    or (
      not is_internal
      and exists (select 1 from public.support_requests r where r.id = support_messages.request_id and r.founder_id = auth.uid())
    )
  );

-- Founders can only add normal (not internal) messages to their own requests.
drop policy if exists support_messages_insert_founder on public.support_messages;
create policy support_messages_insert_founder on public.support_messages
  for insert with check (
    author_user_id = auth.uid()
    and author_role = 'founder'
    and not is_internal
    and exists (select 1 from public.support_requests r where r.id = support_messages.request_id and r.founder_id = auth.uid())
  );

-- 3. Channels: requests can now arrive by email or from an assistant chat.
alter table public.support_requests drop constraint if exists support_requests_source_check;
alter table public.support_requests add constraint support_requests_source_check
  check (source = any (array['request_help', 'question', 'manual', 'email', 'chat']));

-- 4. Private bucket for support PDFs (read through short-lived signed links only).
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
