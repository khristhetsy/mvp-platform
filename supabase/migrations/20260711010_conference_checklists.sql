-- Weekly Meeting System — conference checklist templates (spec §2.5).
-- Reusable checklists (Conference, Talkshow) whose items have a phase (T-30…T+1) and a
-- day offset from the event date. Applying a template to a conference bulk-inserts
-- ceo_meeting_tasks (source='checklist', linked_event_id=conference, due=event_date+offset).
-- The checklist UI reads/writes those tasks.

create table if not exists public.ceo_checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  event_kind  text not null default 'conference',   -- conference | talkshow | summit | webinar
  created_at  timestamptz not null default now()
);

create table if not exists public.ceo_checklist_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.ceo_checklist_templates(id) on delete cascade,
  phase         text not null,                       -- T-30 | T-14 | T-7 | T-1 | T+1
  offset_days   int not null,                        -- -30, -14, -7, -1, +1
  title         text not null,
  department_id uuid references public.departments(id) on delete set null,
  position      int not null default 0
);
create index if not exists ceo_checklist_template_items_tmpl_idx
  on public.ceo_checklist_template_items (template_id, position);

alter table public.ceo_checklist_templates enable row level security;
alter table public.ceo_checklist_template_items enable row level security;

drop policy if exists ceo_checklist_templates_staff on public.ceo_checklist_templates;
create policy ceo_checklist_templates_staff on public.ceo_checklist_templates
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_checklist_template_items_staff on public.ceo_checklist_template_items;
create policy ceo_checklist_template_items_staff on public.ceo_checklist_template_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_checklist_templates to service_role;
grant select, insert, update, delete on public.ceo_checklist_template_items to service_role;

-- ---- Seed: Conference checklist (T-30 → T+1) ----
insert into public.ceo_checklist_templates (id, name, event_kind)
values ('11111111-1111-4111-8111-111111111111', 'Conference', 'conference')
on conflict (id) do nothing;

insert into public.ceo_checklist_template_items (template_id, phase, offset_days, title, position) values
  ('11111111-1111-4111-8111-111111111111', 'T-30', -30, 'Confirm venue, date, and run-of-show', 0),
  ('11111111-1111-4111-8111-111111111111', 'T-30', -30, 'Open registration and publish event page', 1),
  ('11111111-1111-4111-8111-111111111111', 'T-14', -14, 'Finalize speaker lineup and agenda', 2),
  ('11111111-1111-4111-8111-111111111111', 'T-14', -14, 'Launch promotion campaign', 3),
  ('11111111-1111-4111-8111-111111111111', 'T-7',   -7, 'Send reminder to registrants', 4),
  ('11111111-1111-4111-8111-111111111111', 'T-7',   -7, 'Confirm AV, streaming, and booth setup', 5),
  ('11111111-1111-4111-8111-111111111111', 'T-1',   -1, 'Final headcount and day-of briefing', 6),
  ('11111111-1111-4111-8111-111111111111', 'T+1',    1, 'Send thank-you + follow-up to attendees', 7),
  ('11111111-1111-4111-8111-111111111111', 'T+1',    1, 'Reconcile registrations and log outcomes', 8)
on conflict do nothing;

-- ---- Seed: Talkshow checklist ----
insert into public.ceo_checklist_templates (id, name, event_kind)
values ('22222222-2222-4222-8222-222222222222', 'Talkshow', 'talkshow')
on conflict (id) do nothing;

insert into public.ceo_checklist_template_items (template_id, phase, offset_days, title, position) values
  ('22222222-2222-4222-8222-222222222222', 'T-14', -14, 'Book guest and confirm topic', 0),
  ('22222222-2222-4222-8222-222222222222', 'T-7',   -7, 'Prepare questions and promo assets', 1),
  ('22222222-2222-4222-8222-222222222222', 'T-1',   -1, 'Tech check and rehearsal', 2),
  ('22222222-2222-4222-8222-222222222222', 'T+1',    1, 'Publish recording and clips', 3)
on conflict do nothing;
