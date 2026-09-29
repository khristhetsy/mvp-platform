-- IR Hub: "Blocked by" on Share Project records and weekly tasks (mockup screens 3 and 4).
-- A blocker is {label, cleared_at|null}; presets are Data room ready / One pager approved by
-- founder / Updated deck uploaded, free text allowed. Run in the SQL editor.

alter table public.ir_matches add column if not exists blockers jsonb not null default '[]'::jsonb;
alter table public.ir_tasks   add column if not exists blockers jsonb not null default '[]'::jsonb;
