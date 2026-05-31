# CapitalOS deployment checklist

Use this checklist before every **staging** rehearsal and **production** release. Do not skip staging.

## Pre-deploy (all tiers)

- [ ] `npm run check:env` passes for the target tier’s variables
- [ ] `npm run build` passes (or `npm run build:staging` / `npm run build:production`)
- [ ] No unintended schema changes outside reviewed migrations
- [ ] Secrets configured in Vercel (not committed to git)

## Staging deployment

### Build & config

- [ ] `APP_ENV=staging` set on Vercel Preview / staging project
- [ ] Staging Supabase URL and keys configured (not production)
- [ ] `NEXT_PUBLIC_APP_URL` matches staging domain
- [ ] `GOOGLE_REDIRECT_URI` matches staging domain + Google Cloud console entry

### Database

- [ ] All pending migrations applied to **staging** Supabase (in order)
- [ ] Migration smoke: app boots without SQL errors

### Functional tests (staging)

- [ ] **Auth** — sign up, sign in, sign out, role redirect (founder / investor / admin)
- [ ] **Founder flow** — onboarding, documents upload, settings, dashboard
- [ ] **Investor flow** — onboarding, marketplace/deals, interest, watchlist
- [ ] **Admin flow** — companies review, investors, SPVs list, reports export
- [ ] **RLS** — founder cannot read other companies’ private data; investor scoped correctly
- [ ] **Page Builder Lab** — load lab, save draft, preview (if enabled for your admin user)
- [ ] **SPV workflows** — admin SPV page loads; investor SPV participation (if test data exists)
- [ ] **Messaging / notifications** — basic thread load (if test accounts exist)

### Sign-off

- [ ] Staging checklist complete — approved to proceed to production

---

## Production deployment

### Backup (required before migrations)

- [ ] `DATABASE_URL` configured for production backup scripts
- [ ] `npm run ops:backup-db` completed successfully
- [ ] Backup verification recorded (see `docs/backup-and-recovery.md`)

### Database

- [ ] Same migrations already validated on **staging** applied to **production**
- [ ] No manual SQL hotfixes unless documented

### Deploy

- [ ] `APP_ENV=production` on Vercel Production
- [ ] Production env vars match `.env.production.example` (real values, not placeholders)
- [ ] Deploy only after **staging passes**
- [ ] Monitor Vercel build logs — build must succeed

### Post-deploy smoke (production)

- [ ] `/auth/sign-in` loads
- [ ] Founder dashboard loads for test founder account
- [ ] Investor dashboard loads for test investor account
- [ ] Admin dashboard loads for admin account
- [ ] `/admin/system-health` — environment panel shows `APP_ENV=production`, correct Supabase host
- [ ] No configuration-error redirect on protected routes
- [ ] Critical API health: document signed URL, one admin read path

---

## Rollback plan

- [ ] Previous Vercel deployment ID noted before promote
- [ ] Database rollback plan documented if migration is reversible (prefer forward-fix when not)
- [ ] On-call / owner identified for first 30 minutes post-deploy

---

## References

- Environment setup: `docs/environments.md`
- Supabase migrations: `docs/supabase-setup.md`
- Backups: `docs/backup-and-recovery.md`
