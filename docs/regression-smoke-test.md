# CapitalOS regression smoke test (manual)

Use this checklist after migrations or major feature merges. This is **not** a full QA plan — it’s a fast regression gate.

## Pre-flight
- [ ] `npm run build` passes locally or in CI
- [ ] Correct environment variables set for the target tier (see `docs/environments.md`)
- [ ] Migrations applied on staging and verified (see `docs/migration-checklist.md`)
- [ ] `/admin/system-health` launch readiness: migration floor 0056 applied, security checks OK
- [ ] `GET /api/admin/launch-readiness` returns 200 for staff (503 if blockers — expected until fixed)

## Auth + role routing
- [ ] Founder can sign in and reach `/founder`
- [ ] Investor can sign in and reach `/investor/dashboard`
- [ ] Admin can sign in and reach `/admin`
- [ ] Non-staff cannot access `/admin/*` routes

## Launch security (private beta gate)
- [ ] Founder cannot set `profiles.role` to `admin`/`analyst` via profile update or signup metadata
- [ ] Investor cannot set `investor_profiles.approval_status` to `approved` via direct client update
- [ ] Approved investor **without** saved deal/interest/intro/deal room/SPV link cannot read unrelated company documents (RLS + signed URL)
- [ ] Investor cannot read `SPV_REQUIREMENT` documents for other investors

## Admin smoke
- [ ] `/admin/system-health` loads (no secrets displayed)
- [ ] Migration warning banner absent when floor 0056 is applied
- [ ] Launch readiness panel shows env, cron, OpenAI, Stripe, Google OAuth, beta mode status
- [ ] Beta invite link generation works (founder + investor)
- [ ] `/admin/dashboard` loads
- [ ] `/admin/queues` loads and does not crash when empty
- [ ] `/admin/actions` loads and lifecycle updates work
- [ ] `/admin/automation` loads; dry run works via “run automation” controls if available
- [ ] `/admin/audit` loads
- [ ] `/admin/analytics` loads; switching 7/30/90 windows works
- [ ] `/admin/insights` loads; switching 7/30/90 windows works
- [ ] `/admin/imports` loads; preview and confirm flows work for a small test file
- [ ] `/admin/integrations` loads; test/preview/retry endpoints are staff-only
- [ ] `/admin/companies` loads; company workspace `/admin/companies/[companyId]` loads
- [ ] `/admin/investors` loads
- [ ] `/admin/spvs` loads; refresh readiness works
- [ ] `/admin/deal-rooms` loads; staff can create a deal room from the UI
- [ ] `/admin/reports` loads; export/download paths work
- [ ] `/admin/compliance` loads

## Exports
- [ ] `/api/admin/analytics/export?format=json&window=30` returns 200 (staff only)
- [ ] `/api/admin/analytics/export?format=csv&window=30` downloads CSV (staff only)
- [ ] `/api/admin/insights/export?format=json&window=30` returns 200 (staff only)
- [ ] `/api/admin/insights/export?format=csv&window=30` downloads CSV (staff only)
- [ ] `/api/admin/audit/export?format=json` returns 200 (staff only)

## Founder smoke
- [ ] `/founder/report` shows empty state when no `diligence_reports` row exists (no mock sample report)
- [ ] `/founder` readiness score uses real report or document checklist (not hardcoded mock 82)
- [ ] `/founder/actions` loads
- [ ] `/founder/settings` loads and updates save
- [ ] `/founder/capital-raise` loads even with 0 SPVs
- [ ] `/founder/investors` loads
- [ ] `/founder/learning` loads

## Investor smoke
- [ ] `/investor/dashboard` loads
- [ ] `/investor/actions` loads
- [ ] `/investor/opportunities` loads
- [ ] `/investor/portfolio` loads
- [ ] `/investor/spvs` loads even with 0 participations
- [ ] `/investor/messages` loads even with 0 threads

## Collaboration + email + assistant
- [ ] Collaboration comments load and post (`GET/POST /api/collaboration`) without leaking private data
- [ ] Email draft works (`POST /api/email/draft`) and never auto-sends
- [ ] Assistant works (`POST /api/assistant/chat`) and does not crash on empty context

## Final
- [ ] No console errors on core pages (admin + founder + investor)
- [ ] No raw stack traces returned by API endpoints

