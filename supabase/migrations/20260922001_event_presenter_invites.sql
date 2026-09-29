-- Presenter invitations for an event, and the materials a presenter hands in.
--
-- Until now the only path into an event was inbound: a founder applies via
-- speaker_applications. There was no way for staff to invite someone, and
-- nowhere for a presenter to put a pitch video or a deck.
--
-- Two audiences, deliberately different:
--   · Founder / Founder Showcase — have iCapOS accounts, so the invitation
--     appears in their portal at /founder/events/present.
--   · Exhibitor — a booth in the hall, usually no account at all. They get a
--     signed link and never sign in. That is why email, not profile_id, is the
--     identity here, and why profile_id stays nullable.

-- 'exhibitor' joins the existing application kinds. The enum is shared with
-- speaker_applications, so an accepted invite can produce an application row of
-- the same kind rather than inventing a parallel vocabulary.
--
-- Deliberately a bare statement: ALTER TYPE ... ADD VALUE is not reliable inside
-- a DO block, and IF NOT EXISTS already makes it safe to re-run. Nothing below
-- writes the literal 'exhibitor', so it never needs the new value in the same
-- transaction that adds it.
alter type speaker_application_kind add value if not exists 'exhibitor';

do $$ begin
  create type event_invite_status as enum ('invited', 'accepted', 'declined', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists public.event_presenter_invites (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  session_id     uuid references public.sessions(id) on delete set null,
  presenter_id   uuid references public.event_presenters(id) on delete set null,
  -- Null until an invited email matches an iCapOS account. Exhibitors usually
  -- stay null forever, and that is a valid end state, not a missing link.
  profile_id     uuid references public.profiles(id) on delete set null,
  kind           speaker_application_kind not null,
  email          text not null,
  display_name   text,
  status         event_invite_status not null default 'invited',
  -- Personal line from the staff member; shown verbatim to the invitee.
  note           text,
  materials_due  date,
  -- Rotated to revoke a live link without deleting the row's history.
  token_nonce    uuid not null default gen_random_uuid(),
  invited_by     uuid references public.profiles(id) on delete set null,
  invited_at     timestamptz not null default now(),
  responded_at   timestamptz,
  decline_reason text,
  last_reminded_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One live invitation per person per event. Withdrawn rows are kept for history
-- but must not block re-inviting, so the constraint only covers open states.
create unique index if not exists event_presenter_invites_one_open
  on public.event_presenter_invites (event_id, lower(email))
  where status in ('invited', 'accepted');

create index if not exists event_presenter_invites_event_idx   on public.event_presenter_invites (event_id, status);
create index if not exists event_presenter_invites_profile_idx on public.event_presenter_invites (profile_id) where profile_id is not null;

-- ── Materials ────────────────────────────────────────────────────────────────
-- Video is a URL because nothing here hosts video and a pitch recording dwarfs
-- the 25MB document ceiling. The deck is a Storage path, PDF only, validated in
-- app code by lib/uploads/policy.ts (PDF_ONLY, 25MB) — the same policy SPV
-- documents, admin tasks and e-signature already use.
alter table public.event_presenters add column if not exists video_url         text;
alter table public.event_presenters add column if not exists deck_path         text;
alter table public.event_presenters add column if not exists deck_filename     text;
alter table public.event_presenters add column if not exists deck_bytes        bigint;
alter table public.event_presenters add column if not exists materials_updated_at timestamptz;

alter table public.event_presenter_invites enable row level security;

drop policy if exists event_invites_staff_all on public.event_presenter_invites;
create policy event_invites_staff_all on public.event_presenter_invites
  for all using (public.is_staff()) with check (public.is_staff());

-- A founder sees their own invitation in the portal. Exhibitors never reach
-- this policy: they arrive on a signed link with no session, and that route
-- reads through the service role after verifying the token.
drop policy if exists event_invites_own_read on public.event_presenter_invites;
create policy event_invites_own_read on public.event_presenter_invites
  for select using (profile_id = auth.uid());

drop policy if exists event_invites_own_respond on public.event_presenter_invites;
create policy event_invites_own_respond on public.event_presenter_invites
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

comment on table public.event_presenter_invites is
  'Outbound invitations to present or exhibit at an event. Founder/Founder Showcase respond in the portal; exhibitors respond on a signed link with no account.';
comment on column public.event_presenter_invites.token_nonce is
  'Mixed into the signed link. Rotate to revoke an outstanding link without losing the invitation history.';
comment on column public.event_presenters.video_url is
  'Pitch video link (YouTube/Vimeo/Loom). URL only — no video is hosted here.';
comment on column public.event_presenters.deck_path is
  'Storage path of the pitch deck. PDF only, 25MB cap, enforced by lib/uploads/policy.ts.';
