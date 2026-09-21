-- Event Brochure — one name per booklet, per event.
--
-- Booklets used to be created the instant an event was picked, with a title
-- generated as "<event> — Issue <year>" and never checked. Two runs produced
-- two rows identical in every visible way, and the library gave you no way to
-- tell them apart.
--
-- Two parts: rename the duplicates that already exist, then stop new ones.
-- Scoped to one event — two different events may both want "Issue 2026";
-- two booklets for the SAME event may not share a name.

-- ── 1. Rename existing duplicates ───────────────────────────────────────────
-- Nothing is deleted. The oldest row of each colliding group keeps its name;
-- the rest get " (2)", " (3)"… in creation order, which is what the app would
-- have offered had it been asking. Without this the index below cannot be
-- created at all.
with dupes as (
  select
    id,
    row_number() over (
      partition by event_id, lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))
      order by created_at, id
    ) as n
  from public.event_brochures
  where event_id is not null
)
update public.event_brochures b
set title = b.title || ' (' || d.n || ')'
from dupes d
where b.id = d.id
  and d.n > 1;

-- ── 2. Tidy every title to the form the app stores ──────────────────────────
-- Trimmed, with runs of whitespace collapsed — so "Issue  2026" and
-- "Issue 2026" can't sit side by side looking identical.
update public.event_brochures
set title = btrim(regexp_replace(title, '\s+', ' ', 'g'))
where title <> btrim(regexp_replace(title, '\s+', ' ', 'g'));

-- ── 3. Make it true rather than merely likely ───────────────────────────────
-- The app checks before inserting; this is what holds when two tabs check at
-- the same moment. Archived imports with no event are left out: they have no
-- event to be unique within.
create unique index if not exists event_brochures_unique_title_per_event
  on public.event_brochures (event_id, lower(btrim(regexp_replace(title, '\s+', ' ', 'g'))))
  where event_id is not null;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect: no rows (every event/title pair now appears once).
-- select event_id, lower(btrim(title)) as name, count(*)
-- from public.event_brochures
-- where event_id is not null
-- group by 1, 2 having count(*) > 1;
