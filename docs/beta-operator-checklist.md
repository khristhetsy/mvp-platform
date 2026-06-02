# Beta operator checklist

Staff-supervised private beta operations for CapitalOS.

## Before inviting anyone
- [ ] On `/admin/system-health`, **Private beta launch readiness** shows no blockers
- [ ] Migration floor `0056_launch_hardening_security` verified as applied (DATABASE_URL configured on server)
- [ ] Security verification checks all green
- [ ] `PRIVATE_BETA_MODE=true` (and `NEXT_PUBLIC_PRIVATE_BETA_MODE=true` for signup UI) if running curated beta
- [ ] `npm run build` passed on the deployment branch

## Cohort setup
- [ ] Generate founder invite via **Beta onboarding tools** on system health
- [ ] Generate investor invite only for pre-vetted contacts
- [ ] Record invite in your external tracker (email, firm, date, operator)

## Daily (see `docs/daily-operations-checklist.md`)
- [ ] Review pending company approvals (`/admin/companies`)
- [ ] Review investor onboarding queue (`/admin/investors`)
- [ ] Check deal room unresolved questions/doc requests (`/admin/deal-rooms`)
- [ ] Scan failed automation/orchestration counts on system health

## Incident response
- [ ] If migration banner appears on system health, pause new invites until migrations are applied
- [ ] If investor reports document access issues, confirm relationship exists (interest, saved deal, intro, deal room, SPV)
- [ ] Never share service role keys or DATABASE_URL in chat/email
