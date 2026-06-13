# Beta support playbook

Staff guide for supporting CapitalOS private beta users.

## Dashboards
- **`/admin/beta-operations`** — activation, inactivity flags, feedback queue, operational feed
- **`/admin/system-health`** — launch readiness, migrations, security verification

## Common founder issues

| Issue | Action |
|-------|--------|
| Stuck in onboarding | Open company workspace → review onboarding steps; use **Remind onboarding** |
| Documents not uploading | Check system health failed uploads; verify storage buckets |
| No diligence report | Expected if Claude AI unconfigured; use honest empty state on `/founder/report` |
| Deal room doc request pending | Open deal room from admin; nudge founder via notification reminder |

## Common investor issues

| Issue | Action |
|-------|--------|
| Cannot access opportunities | Confirm `investor_profiles.approval_status = approved` |
| Cannot view company documents | Confirm relationship (interest, saved deal, intro, deal room, SPV) |
| Pending approval too long | Review `/admin/investors` queue |

## Support actions (beta operations UI)
- **Copy login link** — share `/auth/sign-in` (no password reset via this tool)
- **Remind onboarding** — in-app notification only (no email)
- **Open company / investors / deal rooms** — deep links for staff

## Feedback triage
1. Review queue on `/admin/beta-operations`
2. Reproduce if bug; link to company/investor profile
3. Mark resolved/dismissed via API or future UI control
4. Critical severity → same-day staff response

## Escalation
See `docs/operational-escalation-checklist.md`.
