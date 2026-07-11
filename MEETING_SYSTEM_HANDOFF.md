# Weekly Management Meeting System — Build Handoff

Built against `meeting-system-build-spec.md v1.0`, extending the existing CEO Hub
(`ceo_meeting_*`) rather than a parallel schema. Verified: ESLint clean + TypeScript
type-check passes across the full meeting-system surface and every touched consumer file.

## What shipped (by spec section)

- **§1/§7 — Meeting engine + 4-tab flow.** `/admin/meetings/[id]` shell with the numbered
  flow: **1 Dashboard** (readiness board, carryover, tasks, attendance) · **2 Departments**
  (per-dept sub-tabs → journals, KPI Sheet link, live 📡 analytics) · **3 Summary & AI** ·
  **4 Plan of Action**. Header carries live status + Start/Close controls + Google Meet.
- **§2.1/§4 — Meeting integrity.** `start_meeting` sets live and **freezes a weekly KPI
  snapshot per department** into JSONB; `close_meeting` marks un-ready required sections
  deferred and logs the misses. (Also fixed a latent bug: the board read `started_at`,
  which no migration had added.)
- **§2.2 — Tasks.** Dual-note tasks (agent/CEO), carryover from prior meetings, AI
  suggestions confirm-flow.
- **§2.3 — KPI engine.** Definitions/entries/goals, auto-goal (trailing-avg × growth,
  ratchet), Monday cron, roll-up views + Data-Input UI.
- **§2.4 — Marketing workbook.** Email campaign schedule (Resend/SendGrid), campaign
  results with computed MR%/PR%/meeting% (no #DIV/0!), aggregated ROMI; client onboarding
  checklist → auto **conference-ready** flag.
- **§2.5 — Conferences.** Conferences/summits/talkshows with session agenda; checklist
  templates (T-30…T+1) that bulk-create dated prep tasks; registrations pulled from **your
  own iCFO Events** (`registrations` table) — Eventbrite removed per your setup.
- **§2.6 — Plan of Action.** Objectives + milestones, progress, at-risk surfacing.
- **§3 — RLS + journal write-lock.** All new tables `is_staff()` fail-closed. Cross-dept
  prep is private until the meeting starts, and a non-admin can only edit their own
  department's section while scheduled/live — enforced in the app layer (service-role
  reads bypass RLS), matching the spec's architecture note.
- **§5 — AI layer.** Meeting brief, journal draft/polish/points, meeting-summary → CEO
  publish, task suggestions, cross-dept recommendations. Every path writes only to draft
  buffers or `*_suggestions`; a human click creates business rows. Compliance rails
  embedded (no pricing, "engagement traction", no funding-probability claims).
- **§6 — Zero-copy analytics.** `📡` dept tabs read the same Hub metric libraries
  (`loadSalesAnalytics`, `loadIrAnalytics`, lead-lifecycle counts) — no duplication.
- **§8 — CEO cockpit sync.** "Meeting operations" card on the CEO Hub (next meeting
  readiness, open items, at-risk objectives, upcoming events).

Plus the separate 7-item UI batch: lifecycle funnels on Sales/Marketing/IR dashboards
(IR pipeline expanded to a 5-stage funnel), Templates HTML upload, Compose template
picker, calendar color-coding (Google = orange, iCapOS = royal), CEO card de-blued.

## To deploy

**1. Run migrations** in the Supabase SQL editor (staging first), in numeric order.
They are appended to `supabase/RUN_THESE_MIGRATIONS.sql` — blocks `20260711003`
through `20260711014`.

> **`20260711007` (investor pipeline stages) is RUN-ONCE** — it drops and re-adds a check
> constraint, so re-running it after it's applied will error on the duplicate constraint.
> Everything else is idempotent (`if not exists` / `drop policy if exists`).

**2. Push the code:**
```bash
cd ~/mvp-platform && git add -A && git commit -m "Weekly Management Meeting System (spec v1.0)" && git push origin main
```

## Optional configuration

- **Vercel cron** already includes the meeting readiness reminders (hourly) and KPI
  goal recompute (Mondays). No action needed beyond the existing `CRON_SECRET`.
- **AI features** use `ANTHROPIC_API_KEY`; everything degrades to heuristics without it.

## Blocked on you (spec §9 + §11)

1. **SOS KPI Data Input** — share the workbook tab/xlsx so real KPI definitions import 1:1
   (placeholders in place until then).
2. **Historical import scripts** — need the source Google Sheets / xlsx exports
   (management grid, IR sheet, marketing 30-tab workbook).
3. **Security actions (§9):** migrate the "Social Media Passwords" tab to a password
   manager, rotate reused passwords, delete the tab; verify SPF/DKIM/DMARC on the sending
   domain before any launch campaign.
4. **Auto-goal ratchet default** — on or off? (`ratchet_only` flag exists.)
5. **Marketing default presenter** for the agenda seed.
