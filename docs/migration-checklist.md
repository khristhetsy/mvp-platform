# CapitalOS migration checklist (0043 → 0056)

This checklist is a **deployment aid** for applying Supabase migrations safely after the platform expansion.

**Rules**
- Apply migrations **in numeric order**.
- Always run on **staging first**, then production.
- Prefer **forward-fixes** over rollbacks unless the migration is explicitly reversible.

## Required environment (all tiers)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for staging/production runtime + admin health tools)

## Optional / integration environment
- `CRON_SECRET` (required for `/api/cron/run-orchestration` in staging/production)
- `TOKEN_ENCRYPTION_SECRET` (required for Google OAuth integration flows)
- `OPENAI_API_KEY` (optional; assistant runs in fallback mode without it)

---

## 0043 — `import_batches`
- **File**: `supabase/migrations/0043_import_batches.sql`
- **Purpose**: Import pipeline tracking (batch status, row counts, failure counts) for admin import/export workflows.
- **Dependencies**: none
- **Verify**
  - Route: `/admin/imports`
  - Queue: `/admin/queues?queue=imports_exports`
  - API: `POST /api/admin/imports/preview`, `POST /api/admin/imports/confirm`
- **Rollback note**: Avoid rollback; forward-fix status fields / indexes if needed.

## 0044 — `operational_activity_events`
- **File**: `supabase/migrations/0044_operational_activity.sql`
- **Purpose**: Central operational activity/event log powering timelines, audit, and analytics counters.
- **Dependencies**: none
- **Verify**
  - Route: `/admin/audit`
  - Route: `/admin/system-health` (counts and snapshot)
  - API: `/api/next-best-actions` (emits activity)
- **Rollback note**: Forward-fix only; event history is append-only.

## 0045 — `next_best_actions` lifecycle
- **File**: `supabase/migrations/0045_next_best_action_lifecycle.sql`
- **Purpose**: Persisted NBA lifecycle (open/snoozed/overdue/completed/dismissed/escalated/blocked).
- **Dependencies**: 0044 (events used for visibility), but can run independently
- **Verify**
  - Route: `/admin/actions`
  - API: `/api/next-best-actions`, `/api/action-center`
- **Rollback note**: Avoid; forward-fix lifecycle field constraints.

## 0046 — notification orchestration
- **File**: `supabase/migrations/0046_notification_orchestration.sql`
- **Purpose**: Admin-run orchestration pass + tracking for reminders/digests.
- **Dependencies**: 0045 recommended
- **Verify**
  - Route: `/admin/system-health`
  - API: `POST /api/admin/notification-orchestration`
- **Rollback note**: Prefer forward-fix; orchestration logs are operational.

## 0047 — scheduled digests
- **File**: `supabase/migrations/0047_scheduled_digests.sql`
- **Purpose**: Scheduled digest configuration and runs.
- **Dependencies**: 0046 recommended
- **Verify**
  - API: `POST /api/admin/run-digest-pass`
  - Cron: `GET/POST /api/cron/run-orchestration` with `Authorization: Bearer <CRON_SECRET>`
- **Rollback note**: Forward-fix schedule tables/rows.

## 0048 — orchestration runs
- **File**: `supabase/migrations/0048_orchestration_runs.sql`
- **Purpose**: Persist orchestration run results and status (cron/manual), used by health + admin visibility.
- **Dependencies**: 0046/0047 recommended
- **Verify**
  - Route: `/admin/system-health`
  - API: `/api/cron/run-orchestration`
- **Rollback note**: Avoid rollback; forward-fix run writes if needed.

## 0049 — workflow automation
- **File**: `supabase/migrations/0049_workflow_automation.sql`
- **Purpose**: Automation runs/actions + dependency tracking foundation.
- **Dependencies**: 0044/0045 recommended
- **Verify**
  - Route: `/admin/automation`
  - API: `POST /api/admin/run-automation-engine`
- **Rollback note**: Forward-fix only; automation history is operational.

## 0050 — collaboration
- **File**: `supabase/migrations/0050_collaboration.sql`
- **Purpose**: Collaboration threads/comments with visibility controls.
- **Dependencies**: 0044 recommended (operational events)
- **Verify**
  - Route: company workspace `/admin/companies/[companyId]` discussion panel
  - Route: `/admin/spvs` discussion panel
  - API: `GET/POST /api/collaboration`
- **Rollback note**: Avoid rollback; forward-fix visibility policies if issues found.

## 0051 — integrations
- **File**: `supabase/migrations/0051_integrations.sql`
- **Purpose**: Integrations connections, subscriptions, delivery logs, reliability health.
- **Dependencies**: 0044 recommended (delivery/audit events)
- **Verify**
  - Route: `/admin/integrations`
  - APIs: `/api/admin/integrations/*`
- **Rollback note**: Avoid rollback; forward-fix delivery log schema if needed.

## 0052 — founder document replace RLS
- **File**: `supabase/migrations/0052_documents_founder_replace_rls.sql`
- **Purpose**: Founder-safe document replace workflow policies.
- **Verify**: Founder document upload/replace on `/founder/documents`
- **Rollback note**: Forward-fix policies only.

## 0053 — admin learning management phase 1
- **File**: `supabase/migrations/0053_admin_learning_management_phase1.sql`
- **Purpose**: Admin learning course/module management foundation.
- **Verify**: `/admin/learning` loads and staff actions work
- **Rollback note**: Forward-fix only.

## 0054 — learning progress + founder certificates
- **File**: `supabase/migrations/0054_learning_course_progress_and_founder_certificates.sql`
- **Purpose**: Founder learning progress and certificate records.
- **Verify**: `/founder/learning` progress persists
- **Rollback note**: Forward-fix only.

## 0055 — deal rooms phase 1
- **File**: `supabase/migrations/0055_deal_rooms_phase1.sql`
- **Purpose**: Deal room tables, participant RLS, Q&A and document requests.
- **Verify**
  - Routes: `/admin/deal-rooms`, `/founder/deal-room`, `/investor/deal-room`
  - API: `POST /api/admin/deal-rooms`
- **Rollback note**: Avoid rollback; forward-fix participant policies if needed.

## 0056 — launch hardening security
- **File**: `supabase/migrations/0056_launch_hardening_security.sql`
- **Purpose**: Block profile role self-escalation, investor self-approval, and broad investor document reads.
- **Dependencies**: 0055 recommended (deal room relationship access)
- **Verify**
  - Founder/investor cannot set `profiles.role` to staff via profile update
  - Investor cannot set `investor_profiles.approval_status` to `approved` directly
  - Approved investor without relationship cannot read unrelated company documents
  - Signed URL route rejects unrelated investor document access
- **Rollback note**: Do not rollback before private beta; forward-fix policies/triggers only.

