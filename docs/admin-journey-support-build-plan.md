# Admin Journey + Support — Build Plan

_Status: approved design, not yet built. Compiled from the review session on 2026-08-29._

This plan covers two connected bodies of work in the Admin workspace: (A) mirroring the founder's Stage 1–4 journey inside the company workspace and Companies list, and (B) a founder-support system layered on top. Everything below is **additive** and reuses existing systems (journey engine, notifications/orchestration, RBAC, messaging, admin queues). No existing admin control, tab, or panel is removed except the one item explicitly noted.

---

## Guiding principles

- **Single source of truth.** All journey/stage/gate/readiness data comes from the existing `evaluateFounderJourney` / `getJourneyOverview`, so admin and founder always see the same thing.
- **Additive, not destructive.** Existing tabs, controls, and cards stay. New sections are added above them.
- **Reuse over rebuild.** Notifications reuse the orchestration engine + dedup; support reuses messaging + admin queues; permissions reuse RBAC.
- **Labels, not data.** The stage rename is display-only; internal slugs (`initialize/qualify/deploy/optimize`) are unchanged — no data migration for the rename.

---

## Part A — Company workspace: Stage 1–4 mirror

### A1. Rename the stage tabs (display only)
- `Initialize → Onboarding` (Stage 1)
- `Qualify → Preparation` (Stage 2)
- `Deploy → Marketing` (Stage 3)
- `Optimize → Closing` (Stage 4)
- **Review** tab is kept and **moved to after Closing**, so the bar reads: Onboarding · Preparation · Marketing · Closing · Review · Analytics & tools · Settings · User Profile.
- Internal engine slugs unchanged. Update every display string: tab labels, breadcrumbs, stage-approval messages, and the Companies-list Stage column.

### A2. Each stage tab gets two new sections on top
1. **AI recommendation strip** — reads the same gate + readiness data, explains why the founder is blocked, ranks fixes by impact, offers "Apply top fix", "Review nudge", "Ask a follow-up". Reuses the existing Claude diligence AI; degrades gracefully if AI is off.
2. **Founder-menu mirror** — the founder's real menu for that stage (from `founderWorkspaceNavSectionsV2`), each item with live status (Done / Attention / Missing / Not started) and an **Open** button.

Mapping of menu items per stage comes straight from the founder nav (Onboarding: company profile, progress, action center, one-pager; Preparation: readiness rating, checklist, data room, documents, business plan, pitch deck, financial model, cap table, valuation; Marketing: investor matches, matching center, automated outreach, investor CRM, events, marketplace; Closing: deal room, offering type, SPVs, capital raise, investor updates, milestones, analytics).

### A3. All existing controls stay below, unchanged
Everything currently on each tab remains: Review & marketplace actions (Approve / Reject / Request changes / Publish / Unpublish / Mark as sample / View company / documents / pitch deck), plus the Founder Onboarding, Investor Matching, Learning Progression, Remediation Plan, Founder Subscription, Admin Feedback, Documents, Investable Readiness, Investor Activity, and SPV panels — each staying on whichever tab it lives on today.

### A4. Every stage always visible
Later stages the founder hasn't reached are **not hidden** — their menu items render as "Not started" so staff can see the whole path.

### A5. Remove the company quick-link row
Delete the top shortcut row (Review company, Open reports, View SPVs, Open CRM, Audit trail, Open compliance). Destinations remain reachable from the left nav and the audit trail still surfaces via the act-on-behalf log and Analytics & tools timeline.

### A6. "Open" behavior = Act on behalf (permission-gated)
- Open lands staff on the founder's real screen for **that company**, editable.
- Persistent "Acting as {company}" banner with Exit-to-admin.
- Writes go to the founder's records via the service-role path (RLS blocks staff writes otherwise), **attributed to the staff member** in the audit trail.
- Founder is **notified after** each change (no pre-consent).
- Gated behind an RBAC permission; staff without it get **read-only view-as** instead.

---

## Part B — Directory → Companies

### B1. Journey view (new view mode)
A fourth toggle beside Kanban / Grid / List. One row per company across the four stages: stage progress bar, status chip (On track / Awaiting approval / Stalled / Overdue / Rejected), readiness %, days idle, next action, and an inline action (Approve / Nudge / Open). Keeps the page's existing search, All-stages filter, and stage-approval banner. Selecting a company opens its workspace.

### B2. User-type filter
A "User type" select (All users / Founders / Investors) next to search + stage filters, with an active-filter chip and result count. (Open item: whether "Investors" switches this list to investor accounts or lives on the Investors page — see Open items.)

---

## Part C — Journey notifications ("notify until complete")

- Extend detection to **all four stages** (today only the approval-wait is watched). A stalled-stage detector runs in the existing orchestration pass and re-fires on a cadence until the founder advances the stage (state change stops it).
- **Recipients:** staff in-app alert + a once-daily staff **email digest** of everyone stuck + a **founder nudge** (in-app + email), generalizing the current Preparation-only nudge to all stages.
- Reuses the existing 24h dedup and the 48/96h-style SLA rules. All alerts deep-link to the Journey view or the company's stage tab.

---

## Part D — Founder support system

### D1. Dedicated Support menu item
A new top-of-nav **Support** section with a **Support queue** item carrying a live open/breaching count badge. Data layer reuses the existing admin-queues system.

### D2. Unified support queue
One triage list combining: founder **Request help**, founder **questions**, **stalled** founders (from Part C), and pending **approvals**. Columns: company, source tag, item, SLA clock (with breach flag), at-risk health, action. **Open** routes by source: Request help / Question → the support thread; Stalled / Approval → the company's stage tab.

### D3. Per-company support thread
Conversation tied to the company (reuses messaging). Includes: **AI-drafted reply** staff edit before sending; a **remediation playbook** per common blocker for consistent answers; a **status/ETA** control that updates the founder; and **post-resolution CSAT** (thumbs up/down tied to the staff member).

### D4. Founder side
- **Request help** button on the stuck screen, pre-filled with stage + item, landing in the queue with full context.
- **Contextual self-serve help** (a knowledge snippet for that item) to deflect easy questions.
- **Status/ETA banner** once a request is open ("We're on it — ETA today"), to cut down "any update?" messages.

### D5. Notification matrix
- Founder posts / requests help → assigned staff (in-app + email); if unassigned → support pool (in-app, deduped).
- Founder replies on a resolved thread → reopens + pings the handling staff.
- Staff reply / status change / resolve → founder (in-app + email; resolve prompts CSAT).
- SLA approaching/breach → assigned rep reminder, then escalate to support lead/admin.
- Thumbs-down CSAT → support lead.

### D6. Assignment
- **Per request:** an "Assign to" picker on queue rows and the thread header (shows each teammate's open load; "Assign to me" shortcut).
- **In Support settings:** the eligible-staff list (only those with the support permission appear) + an auto-assign rule (round-robin by load / company owner / leave unassigned). Manual assignment always overrides.

### D7. Permission
**One RBAC permission** covers both **support** (appearing in the assign picker) and **act-on-behalf** (A6). Staff without it get read-only view-as and don't appear in the picker.

---

## Data / migrations

- **Part A rename, A5, Journey view, User-type filter, notifications:** no new tables. Reuse `journey_stage`, `stage_approval_*`, existing notifications + orchestration.
- **Act-on-behalf:** no new table for the write itself (service-role path); audit uses existing `operational_activity_events` with an "on behalf" attribution. New **RBAC permission slug**.
- **Support:** new tables for support requests/threads, messages, assignment, and CSAT (additive migration, run in Supabase after review). Reuse messaging where possible.

All migrations are additive/idempotent, applied manually in Supabase (staging → verify → production), per house rules.

---

## Suggested phasing

1. **Stage rename + tab reorder + remove quick-link row** (display-only, lowest risk).
2. **Founder-menu mirror + AI recommendation** on each stage tab (read-only Open first).
3. **Act-on-behalf** (permission + write path + audit + notify).
4. **Journey view + user-type filter** on Companies.
5. **Journey notifications** (all-stage detector + digest + nudge).
6. **Support**: queue → thread → founder-side → assignment/settings.

Each phase ends with `tsc` + `eslint`, a commit, and (where relevant) a migration handed off for you to run.

---

## Open items (still to decide)

- **User-type filter — Investors:** switch the Companies list to investor accounts, or send investor filtering to the Investors page?
- **Act-on-behalf scope:** all items, or a limited set of items, with the rest read-only?
- **Later-stage items:** show as "Not started" and openable, or greyed/disabled until the founder reaches that stage?
- **Support ↔ act-on-behalf permission:** confirmed as **one** combined permission (revisit only if you want them split).
- **Review tab contents:** kept as-is after the move — revisit only if you want its cards reorganized into the stages.
