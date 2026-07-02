-- Seed the Marketing Daily Operating Console — the 11 marketing modules from the
-- marketing_console spec — into the shared playbook_* tables, keyed with the
-- `mkt:` prefix so they render in the marketing console (/admin/marketing/console)
-- and are kept out of the admin Daily Console + its drift report.
--
-- Re-runnable: on conflict do nothing.

insert into public.playbook_module (nav_id, block, sort_order, role_note, cadence, count_source) values
  ('mkt:dashboard',     'open',   10, 'Engagement funnel + integration health for the day.', 'daily', null),
  ('mkt:action-center', 'open',   20, 'Staged batches, bounce alerts, and webhook backlog.', 'daily', null),
  ('mkt:reply-inbox',   'open',   30, 'Unhandled replies — route and clear them.', 'daily', null),
  ('mkt:lead-pipeline', 'core',   40, 'Mirrored leads from Odoo + import hygiene.', 'daily', null),
  ('mkt:campaigns',     'core',   50, 'Campaigns and batches — QA, review, send in thirds.', 'daily', null),
  ('mkt:phone',         'core',   60, 'Open phone tasks, capped and suppression-filtered.', '2-3x_week', null),
  ('mkt:assets',        'core',   70, 'Content assets and freshness (review after ~30 days).', 'weekly', null),
  ('mkt:brand',         'core',   80, 'Brand consistency — CI palette scan.', 'weekly', null),
  ('mkt:cmo',           'core',   90, 'AI CMO advisory — read-only recommendations.', 'daily', null),
  ('mkt:seo-aeo',       'core',  100, 'Answer-engine visibility and citable pages.', '2-3x_week', null),
  ('mkt:eod',           'close', 110, 'End-of-day rollup, stage tomorrow, log blockers.', 'daily', null)
on conflict (nav_id) do nothing;

insert into public.playbook_step (module_id, step_no, body)
select m.id, s.step_no, s.body from public.playbook_module m
join (values
  ('mkt:dashboard', 1, 'Review the engagement funnel (sends → opens → clicks → replies → signups) at Marketing hub → Dashboard.'),
  ('mkt:dashboard', 2, 'Check integration health: ESP status, Odoo sync age, and the webhook retry queue.'),
  ('mkt:action-center', 1, 'Work staged batches and any bounce or webhook-backlog alerts.'),
  ('mkt:action-center', 2, 'For each staged send: **approve** (routes to the campaign gate), **hold**, or **fix**.'),
  ('mkt:reply-inbox', 1, 'Open replies in the inbox and CRM messages; set a route for each and mark handled.'),
  ('mkt:reply-inbox', 2, 'Any reply mentioning guarantees or placement is auto-suggested to `counsel` — send it to securities counsel, do not answer directly.'),
  ('mkt:lead-pipeline', 1, 'Leads live in Odoo (system of record). Review the mirrored contacts and hygiene flags.'),
  ('mkt:lead-pipeline', 2, 'Mark the segment import clean before scheduling — a segment cannot schedule until its import is clean.'),
  ('mkt:campaigns', 1, 'Build and QA the campaign; split a large send into thirds.'),
  ('mkt:campaigns', 2, 'Send is blocked until `compliance_review = approved` — the send action returns 409 otherwise.'),
  ('mkt:phone', 1, 'Call only non-suppressed leads; log each attempt.'),
  ('mkt:phone', 2, 'The cap is **2 attempts** per lead — the task auto-closes at the cap.'),
  ('mkt:assets', 1, 'Review assets whose freshness is over ~30 days; bump version or mark reviewed.'),
  ('mkt:brand', 1, 'Fix any files flagged by the CI brand scan — approved palette is navy → royal-blue only.'),
  ('mkt:cmo', 1, 'Read the AI CMO insights and act on them manually — this module is read-only for everyone.'),
  ('mkt:seo-aeo', 1, 'Re-check tracked queries; mark a gap to create an asset task, and publish or refresh citable pages at /admin/marketing/aeo.'),
  ('mkt:eod', 1, 'Review today''s engagement rollup and tomorrow''s staged batches; stage tomorrow and write a one-line log of open blockers.')
) as s(nav_id, step_no, body) on s.nav_id = m.nav_id
on conflict (module_id, step_no) do nothing;

insert into public.playbook_flag (module_id, kind, label)
select m.id, f.kind, f.label from public.playbook_module m
join (values
  ('mkt:reply-inbox', 'guardrail', 'Guarantee / placement language routes to securities counsel'),
  ('mkt:lead-pipeline', 'hard_gate', 'A segment cannot schedule until its import is clean'),
  ('mkt:campaigns', 'hard_gate', 'Send blocked unless compliance_review = approved'),
  ('mkt:phone', 'hard_gate', '2-attempt call cap (enforced in the database)'),
  ('mkt:phone', 'guardrail', 'Suppress-on-convert — converted / unsubscribed leads are excluded'),
  ('mkt:brand', 'guardrail', 'Navy → royal-blue only; deprecated hexes flagged by CI'),
  ('mkt:cmo', 'guardrail', 'Read-only advisory — no write path')
) as f(nav_id, kind, label) on f.nav_id = m.nav_id;
