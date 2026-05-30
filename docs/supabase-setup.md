# Supabase Setup

1. Copy `.env.example` to `.env.local` and add your real Supabase project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
2. Run migrations in order in the Supabase SQL editor (or via Supabase CLI):
   - `supabase/migrations/0001_initial_schema_rls.sql`
   - `supabase/migrations/0002_auto_profile_trigger.sql`
   - `supabase/migrations/0003_company_members_rls_storage.sql`
   - `supabase/migrations/0004_documents_upload_hardening.sql`
   - `supabase/migrations/0005_company_settings_hardening.sql`
   - `supabase/migrations/0006_storage_company_documents_policies.sql`
   - `supabase/migrations/0007_admin_platform_linking.sql`
   - `supabase/migrations/0008_admin_rls_hardening.sql`
   - `supabase/migrations/0009_marketplace_publication.sql`
   - `supabase/migrations/0010_investor_actions.sql`
   - `supabase/migrations/0011_backfill_marketplace_campaigns.sql`
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
