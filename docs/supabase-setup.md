# Supabase Setup

1. Copy `.env.example` to `.env.local` and add your real Supabase project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
2. Run migrations **in numeric order** in the Supabase SQL editor (or via Supabase CLI). Apply every file from `0001` through `0038` on a fresh project:

   | # | File |
   |---|------|
   | 0001 | `0001_initial_schema_rls.sql` |
   | 0002 | `0002_auto_profile_trigger.sql` |
   | 0003 | `0003_company_members_rls_storage.sql` |
   | 0004 | `0004_documents_upload_hardening.sql` |
   | 0005 | `0005_company_settings_hardening.sql` |
   | 0006 | `0006_storage_company_documents_policies.sql` |
   | 0007 | `0007_admin_platform_linking.sql` |
   | 0008 | `0008_admin_rls_hardening.sql` |
   | 0009 | `0009_marketplace_publication.sql` |
   | 0010 | `0010_investor_actions.sql` |
   | 0011 | `0011_backfill_marketplace_campaigns.sql` |
   | 0012 | `0012_investor_crm.sql` |
   | 0013 | `0013_investor_pledge_amounts.sql` |
   | 0014 | `0014_company_pledge_summaries.sql` |
   | 0015 | `0015_subscriptions.sql` |
   | 0016 | `0016_upgrade_requests.sql` |
   | 0017 | `0017_founder_onboarding.sql` |
   | 0018 | `0018_founder_remediation_tasks.sql` |
   | 0019 | `0019_founder_learning.sql` |
   | 0020 | `0020_investor_profiles.sql` |
   | 0021 | `0021_notifications.sql` |
   | 0022 | `0022_message_threads.sql` |
   | 0023 | `0023_connected_accounts.sql` |
   | 0024 | `0024_thread_meetings_calendar_host.sql` |
   | 0025 | `0025_founder_investor_crm.sql` |
   | 0026 | `0026_founder_social_outreach.sql` |
   | 0027 | `0027_compliance_events.sql` |
   | 0028 | `0028_investor_report_viewed_activity.sql` |
   | 0029 | `0029_company_updates.sql` |
   | 0030 | `0030_spv_workflow.sql` |
   | 0031 | `0031_spv_checklist.sql` |
   | 0032 | `0032_spv_participation_requirements.sql` |
   | 0033 | `0033_spv_requirement_documents.sql` |
   | 0034 | `0034_spv_operational_readiness.sql` |
   | 0035 | `0035_spv_document_packages.sql` |
   | 0036 | `0036_spv_closing_reviews.sql` |
   | 0037 | `0037_spv_founder_rls_hardening.sql` (removes founder SELECT on internal SPV notes) |
   | 0038 | `0038_learning_programs_lessons.sql` (programs, lesson progress, quiz attempts) |
3. Confirm the private storage bucket `pitch-decks` exists (`0003` creates it).
4. Pitch deck object path format:

```text
pitch-decks/{company_id}/{user_id}/{timestamp}-{filename}.pdf
```

5. Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code. It is used only in server routes such as onboarding repair and signed URL generation.

## Google Calendar connection (Phase A)

Run migration `0023_connected_accounts.sql` before using Google connect in settings.

Set in `.env.local` (see `.env.example`):

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (must match Google Cloud OAuth redirect URI)
- `TOKEN_ENCRYPTION_SECRET` (server-only; encrypts stored OAuth tokens)

Founders and investors connect at `/founder/settings` or `/investor/settings`. OAuth tokens are encrypted at rest.

Also run `0024_thread_meetings_calendar_host.sql` so accepted meetings store the Google Calendar host user for update/cancel sync.

## Founder investor CRM & controlled outreach (Phase 1)

Run migration `0025_founder_investor_crm.sql` before using `/founder/investors` private CRM and outreach drafts.

This adds founder-private tables (`founder_investor_contacts`, `founder_outreach_targets`, `outreach_campaigns`, `outreach_messages`) with RLS scoped to the owning founder and company. Outreach queues messages internally only — no external email sending in this phase.

## Founder social outreach drafts

Run migration `0026_founder_social_outreach.sql` for investor social URL fields on `founder_investor_contacts` and the `social_outreach_drafts` table.

Social drafts are generated and copied inside CapitalOS only — no LinkedIn API, OAuth, auto-posting, scraping, or external social providers.

## Admin compliance & risk review (Phase 1)

Run migration `0027_compliance_events.sql` before using `/admin/compliance`.

This adds the `compliance_events` table (staff-only RLS) for internal risk flags, outreach/messaging/social compliance alerts, and admin review actions. Events are created by deterministic scanners on page load and by key API paths (social draft flag, outreach without readiness, investor rejection). Founders do not see `internal_notes`.

## Admin audit export & reporting (Phase 1)

Approved investors can open investor-facing company reports at `/investor/opportunities/[companyId]/report` for marketplace-published companies. Views are logged as `report_viewed` in `investor_activity` (run migration `0028_investor_report_viewed_activity.sql`).

Run migration `0029_company_updates.sql` for founder `company_updates` and investor portfolio update feeds at `/investor/portfolio`. Founders publish updates from `/founder/capital-raise`.

## SPV workflow foundation (Phase 1)

Run migration `0030_spv_workflow.sql` before using SPV admin, founder, or investor surfaces.

This adds `spv_opportunities` and `spv_participations` with RLS (staff full access, founders read their company SPVs, investors read/write their own participations and open opportunities). Admin manages opportunities at `/admin/spvs`; founders see status on `/founder/capital-raise`; approved investors participate at `/investor/spvs`. Indications of interest are non-binding — no legal formation, banking, or securities execution in this phase.

Run migration `0031_spv_checklist.sql` for the SPV document readiness checklist (`spv_checklist_items`). Checklist items auto-seed when an admin creates an SPV. Staff manage item status on `/admin/spvs`; founders see category-level progress on `/founder/capital-raise`; investors see a simplified preparation label on `/investor/spvs`. Closing an SPV is blocked until required checklist items are completed or waived.

Run migration `0032_spv_participation_requirements.sql` for per-investor SPV document intake (`spv_participation_requirements`). Requirements auto-seed when a participation is created. Admin reviews requirements and investor readiness on `/admin/spvs`; investors upload via `/investor/spvs` and `POST /api/investor/spv-participation-requirements/[id]/upload`; founders see aggregate counts only on `/founder/capital-raise`. Marking a participation `completed` is blocked until required requirements are approved or waived.

Run migration `0033_spv_requirement_documents.sql` for investor SPV document uploads to the private `spv-investor-documents` bucket. Investors upload via `POST /api/investor/spv-participation-requirements/[id]/upload`; files are linked on `uploaded_document_id` with `document_type = SPV_REQUIREMENT`. Founders cannot access investor SPV documents (RLS excludes `SPV_REQUIREMENT` from founder company document policies). Staff open files via `POST /api/documents/signed-url`.

Run migration `0034_spv_operational_readiness.sql` for automated operational readiness status on `spv_opportunities` (`operational_readiness_status`). The admin SPV command center at `/admin/spvs` shows dashboard KPIs, next-action labels, and readiness states derived from checklist %, investor requirements, and participation totals.

Run migration `0035_spv_document_packages.sql` for the operational document package tracker (`spv_document_packages`). When an SPV reaches `ready_for_legal_docs`, seven default packages are auto-seeded. Admins manage package status and internal notes at `/admin/spvs`; founders see aggregate package progress on `/founder/capital-raise`; investors see a simple public document status on `/investor/spvs`. Notifications fire when packages are seeded, when all packages are approved, and when the subscription package is issued.

Run migration `0036_spv_closing_reviews.sql` for the final operational closing review (`spv_closing_reviews`). Closing readiness is scored from checklist, investor requirements, document packages, indicative target (or admin override), and open critical compliance events. Admins run final review at `/admin/spvs`; founders see a simplified stage on `/founder/capital-raise`; investors see a simple closing status on `/investor/spvs`. Notifications fire when an SPV is ready for final review, when approved for closing, and when marked operationally closed.

Staff can export the **SPV Readiness Report** (`spv_readiness`) from `/admin/reports` as JSON, CSV, or PDF (PDFKit). Filters include date range, company, SPV status, operational readiness, and closing review status. Exports exclude investor documents, file paths, message bodies, and internal legal notes; each export writes `audit_logs` with `admin.report_generated`.

Use `/admin/reports` (staff-only) to generate JSON, CSV, or **PDF** internal summaries from existing tables, including **Due Diligence** (`due_diligence`) per-company readiness packs. PDF export uses server-side [PDFKit](https://pdfkit.org/) (`pdfkit` dependency) via `src/lib/reports/pdf-export.ts` — no external PDF API. Each export writes an `audit_logs` row (`admin.report_generated`) with `format` (`json`, `csv`, or `pdf`). OAuth tokens, message bodies, and private founder contact PII are excluded from exports.

## Data model

```text
auth.users.id
  → profiles.id
  → company_members.user_id
  → companies.id
  → documents.company_id
```

## Onboarding

After signup or login, the app calls `POST /api/onboarding` to:

- upsert `profiles`
- find or create a founder company (once per user)
- link `company_members` with role `owner`

## Admin dashboard

Run migration `0007_admin_platform_linking.sql` before using approval workflows. It adds:

- `companies.review_status`, `approved_at`, `approved_by`
- `admin_reviews.founder_id`, `feedback`, `requested_changes`
- Staff/investor RLS policies and foreign key indexes

The admin dashboard at `/admin/dashboard` loads live data from Supabase (founders, companies, documents, pitch decks, admin reviews). Review actions call `POST /api/admin/companies/[id]/review` with `{ action, feedback? }`. Marketplace publication uses `POST /api/admin/companies/[id]/marketplace` with `{ action: "publish" | "unpublish" }`.

Marketplace pages (`/deals`, `/investors`, home featured listings) query companies where:

- `review_status = 'approved'`
- `is_published = true`
- `marketplace_visible = true`
- `published_at IS NOT NULL`

Approving a company sets all of the above automatically and creates/updates a linked `campaigns` row for investor interest requests.

To apply migrations with a direct DB connection:

```bash
# Add DATABASE_URL to .env.local (Supabase → Project Settings → Database)
node scripts/apply-migration.mjs supabase/migrations/0007_admin_platform_linking.sql
```

Or repair missing marketplace campaigns with:

```bash
node scripts/repair-marketplace-campaigns.mjs
```

## Access model

- Founders can read/update companies they belong to via `company_members` (or legacy `founder_id`).
- Founders can upload/read documents and `pitch-decks` storage objects only for their companies.
- Service role is used server-side for onboarding repair only.
- After `0037`, founders cannot SELECT `spv_document_packages` or `spv_closing_reviews` (internal notes). Founder SPV UI uses aggregate fields on `spv_opportunities` only.

## Backup and recovery

See [backup-and-recovery.md](./backup-and-recovery.md) for database/storage backup scripts, env checklists, incident recovery, and cadence.

## Production deployment (Vercel)

### Required environment variables

| Variable | Where | Notes |
|----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | Project URL from Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only (server) | Never prefix with `NEXT_PUBLIC_` |
| `GOOGLE_CLIENT_ID` | Vercel (server) | OAuth client for Calendar connect |
| `GOOGLE_CLIENT_SECRET` | Vercel (server) | |
| `GOOGLE_REDIRECT_URI` | Vercel (server) | Production URL, e.g. `https://your-domain.com/api/integrations/google/callback` |
| `TOKEN_ENCRYPTION_SECRET` | Vercel (server) | 32+ chars; `openssl rand -base64 32` |

Optional: `OPENAI_API_KEY` (server) if AI diligence/draft features are enabled.

If `NEXT_PUBLIC_SUPABASE_*` is missing in production, the app **fails closed**: protected routes redirect to `/configuration-error` instead of allowing anonymous access.

### Google OAuth (production)

1. In Google Cloud Console → APIs & Services → Credentials, create an OAuth 2.0 Web client.
2. Add **Authorized redirect URI** exactly matching `GOOGLE_REDIRECT_URI` (no trailing slash mismatch).
3. Enable Google Calendar API for the project.
4. Set the same client ID/secret in Vercel for Production (and Preview if you test OAuth on preview URLs).
5. Founders/investors connect from `/founder/settings` or `/investor/settings`. Failed OAuth or calendar sync is logged to `audit_logs` via operational event helpers.

### Vercel checklist

1. Link repo; set **Root Directory** to the app root if monorepo.
2. Set all required env vars for **Production** (and Preview if needed).
3. Run migrations `0001`–`0038` on the production Supabase project before first deploy.
4. Confirm storage buckets: `pitch-decks`, `spv-investor-documents` (from migrations).
5. Deploy; smoke-test sign-in, founder upload, admin reports export, SPV **Refresh readiness** on `/admin/spvs` (does not run sync on page load).
6. Supabase Auth → URL configuration: add production site URL and redirect URLs for `/auth/callback`.

### Post-deploy verification

- Founder cannot query `spv_document_packages.notes` or `spv_closing_reviews.internal_notes` via API (403/empty after `0037`).
- Admin SPV list loads without writing readiness snapshots until **Refresh readiness** is clicked.
- Rate limits return `429` on burst report exports / uploads (in-memory per instance on Vercel).
