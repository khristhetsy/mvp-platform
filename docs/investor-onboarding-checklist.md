# Investor onboarding checklist (private beta)

## Staff — before invite
- [ ] Pre-qualify investor (accreditation, firm, thesis fit)
- [ ] Generate investor invite from `/admin/system-health`
- [ ] `PRIVATE_BETA_MODE` enabled so signup copy reflects approval requirement

## Investor — signup & profile
- [ ] Sign up via invite (`/auth/sign-up?role=investor`)
- [ ] Complete `/investor/onboarding` and submit for review
- [ ] Do **not** expect full marketplace access until approved

## Staff — approval
- [ ] Review profile on `/admin/investors`
- [ ] Approve, reject, or request changes
- [ ] Create deal room when structured diligence starts (`/admin/deal-rooms`)

## Post-approval verification
- [ ] `/investor/opportunities` loads
- [ ] Document access only for companies with relationship (interest, saved deal, intro, deal room, SPV)
- [ ] Cannot read unrelated company documents
- [ ] SPV flows on `/investor/spvs` work for participations

## Blocked states (expected)
- [ ] Unapproved investor redirected or blocked on sensitive routes (opportunities report, portfolio actions)
- [ ] Self-approval via API/DB client prevented by RLS trigger
