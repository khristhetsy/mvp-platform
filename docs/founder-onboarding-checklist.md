# Founder onboarding checklist (private beta)

## Staff — before invite
- [ ] Generate founder invite link from `/admin/system-health` → Beta onboarding tools
- [ ] Confirm migration floor 0056 applied

## Founder — signup & setup
- [ ] Sign up via invite link (`/auth/sign-up?role=founder`)
- [ ] Complete `/founder/onboarding` (company profile)
- [ ] Upload required documents on `/founder/documents`
- [ ] Review readiness on `/founder/readiness` (checklist score; not mock data)

## Staff — review
- [ ] Review company in `/admin/companies/[companyId]`
- [ ] Approve or request changes before marketplace publication
- [ ] Generate diligence report only when appropriate (`ANTHROPIC_API_KEY` configured or accept summary-only)

## Optional beta flows
- [ ] Founder learning (`/founder/learning`) if enabled for cohort
- [ ] Deal room created by staff when investor diligence begins (`/admin/deal-rooms`)

## Done when
- [ ] Company `review_status` approved (if publishing)
- [ ] Founder sees real diligence report or honest empty state on `/founder/report`
- [ ] No mock readiness score on `/founder` dashboard
