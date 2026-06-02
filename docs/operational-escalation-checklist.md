# Operational escalation checklist

Use when beta operations cannot be resolved at L1 support.

## Severity guide
- **Critical** — security issue, data leak suspicion, auth bypass, migration failure in production
- **High** — investor access to unrelated documents, self-approval, role escalation
- **Medium** — stalled onboarding >14d, failed automations blocking queues
- **Low** — UI copy, non-blocking feedback

## Escalation steps
1. [ ] Capture user ID, company ID, timestamp, and steps to reproduce
2. [ ] Check `/admin/system-health` — migrations green? security checks pass?
3. [ ] Check `/admin/beta-operations` — inactivity flags, failed jobs
4. [ ] If security: pause new invites until verified
5. [ ] If data/RLS: confirm migration floor 0056+ applied
6. [ ] Document in audit trail / external incident log
7. [ ] Eng engineering if code fix required; do not patch production RLS manually without review

## Contacts / roles
- **Operator** — daily queue, reminders, approvals
- **Engineering** — migrations, RLS, API failures
- **Product** — beta scope, cohort expansion

## Post-incident
- [ ] Update regression smoke test if new gap found
- [ ] Resolve open beta feedback linked to incident
