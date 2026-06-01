-- Notification orchestration metadata (in-app only, Phase 1).
-- Rollback: alter table public.notifications drop column if exists severity, orchestration_type, action_id, deep_link, dedupe_key;

alter table public.notifications
  add column if not exists severity text,
  add column if not exists orchestration_type text,
  add column if not exists action_id uuid references public.next_best_actions(id) on delete set null,
  add column if not exists deep_link text,
  add column if not exists dedupe_key text;

create index if not exists notifications_orchestration_dedupe_idx
  on public.notifications (recipient_user_id, dedupe_key, created_at desc)
  where dedupe_key is not null;

create index if not exists notifications_action_id_idx
  on public.notifications (action_id)
  where action_id is not null;
