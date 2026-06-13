# CapitalOS private beta launch requirements

Use this checklist before inviting external founders and investors.

## Database
- [ ] All migrations through `0056_launch_hardening_security.sql` applied on staging, then production
- [ ] Migration verification steps in `docs/migration-checklist.md` completed for 0055–0056

## Security (blocking)
- [ ] Profile role escalation blocked (`profiles` trigger + signup sanitization)
- [ ] Investor self-approval blocked (`investor_profiles` trigger)
- [ ] Investor document access requires company relationship (RLS + signed URL)
- [ ] `SPV_REQUIREMENT` documents not exposed broadly to investors

## Trust / honesty (blocking)
- [ ] `/founder/report` uses real `diligence_reports` or explicit empty state
- [ ] Founder dashboard does not show mock readiness as production data
- [ ] AI diligence does not present unconfigured mock output as a scored real report

## Staff operations
- [ ] `/admin/deal-rooms` create UI works (company + investor + optional SPV/campaign)
- [ ] `/admin/spvs` still loads and operates after document policy changes

## Environment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` server-only (never `NEXT_PUBLIC_*`)
- [ ] `DATABASE_URL` set on server for migration + security verification on `/admin/system-health`
- [ ] `ANTHROPIC_API_KEY` set in production if AI diligence generation is offered; otherwise staff know reports are summary-only
- [ ] `CRON_SECRET` set if orchestration cron is enabled
- [ ] `PRIVATE_BETA_MODE=true` for curated beta (optional; pair with `NEXT_PUBLIC_PRIVATE_BETA_MODE=true` for signup UI)

## Launch readiness dashboard
- [ ] `/admin/system-health` shows **Ready for staff-supervised beta** with no blockers
- [ ] Security verification checks pass (triggers, relationship-scoped document policy)
- [ ] Beta onboarding tools generate audit-logged invite links

## Operator runbooks
- [ ] `docs/beta-operator-checklist.md`
- [ ] `docs/daily-operations-checklist.md`
- [ ] `docs/founder-onboarding-checklist.md`
- [ ] `docs/investor-onboarding-checklist.md`

## Manual regression
- [ ] Complete `docs/regression-smoke-test.md` including launch security section
- [ ] `npm run build` passes

## Known non-blockers (post-beta)
- Stripe payments disabled until explicitly enabled
- Full automated test suite not yet required for private beta gate
