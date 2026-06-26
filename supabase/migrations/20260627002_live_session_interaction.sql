-- Migration: 20260627002_live_session_interaction.sql
-- iCFO Events — live session interaction: upvotable Q&A, live chat, reactions.
-- Reactions are ephemeral (Realtime broadcast, no table). Education/community only.

create table if not exists public.session_questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  is_answered boolean not null default false,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists session_questions_session_idx on public.session_questions(session_id);

create table if not exists public.session_question_votes (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.session_questions(id) on delete cascade,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (question_id, profile_id)
);
create index if not exists session_question_votes_session_idx on public.session_question_votes(session_id);
-- DELETE events need full old-row data so Realtime can report question_id.
alter table public.session_question_votes replica identity full;

create table if not exists public.session_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists session_chat_session_idx on public.session_chat_messages(session_id, created_at);

alter table public.session_questions       enable row level security;
alter table public.session_question_votes  enable row level security;
alter table public.session_chat_messages   enable row level security;

-- Shared read gate: signed-in member of a published/live event.
-- questions
drop policy if exists session_questions_staff_all on public.session_questions;
create policy session_questions_staff_all on public.session_questions
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists session_questions_member_read on public.session_questions;
create policy session_questions_member_read on public.session_questions
  for select using (
    auth.uid() is not null
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live'))
  );
drop policy if exists session_questions_member_insert on public.session_questions;
create policy session_questions_member_insert on public.session_questions
  for insert with check (profile_id = auth.uid());

-- votes
drop policy if exists session_votes_staff_all on public.session_question_votes;
create policy session_votes_staff_all on public.session_question_votes
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists session_votes_member_read on public.session_question_votes;
create policy session_votes_member_read on public.session_question_votes
  for select using (auth.uid() is not null);
drop policy if exists session_votes_owner_write on public.session_question_votes;
create policy session_votes_owner_write on public.session_question_votes
  for insert with check (profile_id = auth.uid());
drop policy if exists session_votes_owner_delete on public.session_question_votes;
create policy session_votes_owner_delete on public.session_question_votes
  for delete using (profile_id = auth.uid());

-- chat
drop policy if exists session_chat_staff_all on public.session_chat_messages;
create policy session_chat_staff_all on public.session_chat_messages
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists session_chat_member_read on public.session_chat_messages;
create policy session_chat_member_read on public.session_chat_messages
  for select using (
    auth.uid() is not null
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live'))
  );
drop policy if exists session_chat_member_insert on public.session_chat_messages;
create policy session_chat_member_insert on public.session_chat_messages
  for insert with check (profile_id = auth.uid());

-- Realtime streams
alter publication supabase_realtime add table public.session_questions;
alter publication supabase_realtime add table public.session_question_votes;
alter publication supabase_realtime add table public.session_chat_messages;
