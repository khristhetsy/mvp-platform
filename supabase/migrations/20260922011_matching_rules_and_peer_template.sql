-- Networking — who may be matched, and what each kind of pair is told.
--
-- The board paired everyone with everyone. At an event with 101 investors and
-- 4 founders that means 1,813 of 2,217 matches are investor-to-investor, while
-- the invitation addresses the reader as an investor being told about a
-- founder. Two peers were being introduced with the wrong sentence.
--
-- So: staff choose the pairings per event, and a pairing between equals gets a
-- message written for equals.

create table if not exists public.event_matching_rules (
  event_id    uuid primary key references public.events(id) on delete cascade,
  -- Pair-type keys from src/lib/icfo-events/pair-types.ts. Unknown keys are
  -- dropped on read, so a rule can never widen the matching by accident.
  pair_types  jsonb not null default '["investor_founder","investor_investor"]'::jsonb,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.event_matching_rules enable row level security;

drop policy if exists event_matching_rules_staff on public.event_matching_rules;
create policy event_matching_rules_staff on public.event_matching_rules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.event_matching_rules to service_role;

-- ── The peer invitation ─────────────────────────────────────────────────────
-- Same shape as the founder one, minus the pitch and the raise: two investors
-- are not pitching each other.

alter table public.event_intro_templates
  drop constraint if exists event_intro_templates_kind_check;

alter table public.event_intro_templates
  add constraint event_intro_templates_kind_check
  check (kind in ('invitation', 'follow_up', 'peer_invitation'));

insert into public.event_intro_templates (kind, subject, body) values
  (
    'peer_invitation',
    'Someone worth knowing at {{event_title}}',
    E'Hi {{first_name}},\n\n'
    '{{founder_line}} is also at {{event_title}}{{shared_line}}.\n\n'
    'If a conversation would be useful, accept below and they will send you a time. Nothing is shared until you both agree.'
  )
on conflict (kind) do nothing;

-- ── Who the mail comes from ─────────────────────────────────────────────────
-- iCapOS keeps replies inside the platform; Gmail puts them in the sender's
-- own inbox, where the reply hook cannot see them. Recorded per introduction
-- so the board can say why a row stopped updating.

alter table public.event_introductions
  add column if not exists sent_via text not null default 'icapos'
    check (sent_via in ('icapos', 'gmail'));

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select kind from public.event_intro_templates order by kind;   -- 3 rows
-- select count(*) from public.event_matching_rules;              -- 0 until saved
