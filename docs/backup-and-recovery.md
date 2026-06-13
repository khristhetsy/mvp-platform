# CapitalOS backup and recovery

Operational runbook for database, storage, environment, and deployment recovery. This project does **not** include third-party backup SaaS, automated cloud snapshots outside Supabase/Vercel, or destructive restore tooling.

## Recommended backup cadence

| Asset | Cadence | Method |
|-------|---------|--------|
| Postgres (Supabase) | **Daily** (prod); weekly (staging) | Supabase managed backups + `scripts/backup-db.sh` before major releases |
| Storage objects | **Weekly** + before SPV/legal milestones | Dashboard export + `scripts/backup-storage.sh` manifest |
| Environment variables | **On every change** | Encrypted password manager + Vercel env export |
| Repo / migrations | Continuous | Git; tag release commits |
| Operational metadata | **Weekly** | `scripts/export-operational-metadata.mjs` |
| Verification | After each backup job | `scripts/verify-backup.sh` |

## Prerequisites

1. Copy `.env.example` → `.env.local` (local) or configure Vercel env (production).
2. Add `DATABASE_URL` for `pg_dump` (Supabase → Project Settings → Database → connection string).
3. Never commit secrets or files under `backups/` (gitignored).

Validate production env:

```bash
node scripts/check-production-env.mjs
```

## 1. Supabase backup procedures

### Managed backups (primary)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Database** → **Backups**.
2. Confirm **Point-in-Time Recovery (PITR)** / daily backups match your plan.
3. Before launch and before applying migrations `0030+`, note the latest restore point.

### Manual SQL export (secondary)

```bash
chmod +x scripts/backup-db.sh scripts/backup-storage.sh scripts/verify-backup.sh
./scripts/backup-db.sh
```

- Writes `backups/db-<UTC-timestamp>.sql.gz` (plain SQL, gzip).
- Read-only `pg_dump`; no destructive operations.
- Logs `backup.database.completed` or `backup.database.failed` to `audit_logs`.

Requires: `DATABASE_URL`, `pg_dump` on PATH.

### Database export via Dashboard

1. Database → **SQL Editor** or **Backups** → export as needed for ad-hoc snapshots.
2. For schema-only review, use migration files in `supabase/migrations/` (source of truth in git).

## 2. Storage bucket backup procedures

Private buckets include at minimum: `pitch-decks`, `company-documents`, `spv-investor-documents`.

### Inventory manifest (automated, safe)

```bash
./scripts/backup-storage.sh
```

- Runs `scripts/storage-manifest.mjs`.
- Writes `backups/storage-manifest-<timestamp>.json` (bucket list + sample counts).
- Does **not** bulk-download objects (rate limits, size, safety).

### Full object backup (manual)

1. Supabase Dashboard → **Storage** → select bucket → download/export objects as needed.
2. For large buckets, export by company or date prefix.
3. Document export date in your incident log.

## 3. Environment variable backup checklist

Store a **redacted checklist** in your password manager; store **actual values** only in secure vaults.

| Variable | Scope | Notes |
|----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never expose to client |
| `DATABASE_URL` | Ops/scripts | Backup scripts only |
| `GOOGLE_CLIENT_ID` | Server | OAuth |
| `GOOGLE_CLIENT_SECRET` | Server | OAuth |
| `GOOGLE_REDIRECT_URI` | Server | Must match production domain |
| `TOKEN_ENCRYPTION_SECRET` | Server | 32+ chars |
| `ANTHROPIC_API_KEY` | Server optional | AI features |
| `NEXT_PUBLIC_SITE_URL` | Public optional | Production URL consistency |

Export Vercel env:

1. Vercel → Project → **Settings** → **Environment Variables**.
2. Export/document Production values after each change.
3. Run `node scripts/check-production-env.mjs` locally with production-like `.env.local` before deploy.

## 4. Vercel deployment backup steps

1. **Git**: ensure `main` (or release branch) is tagged for each production deploy.
2. **Vercel**: Deployments → pin/note the production deployment ID.
3. **Rollback app**: redeploy a previous successful deployment in Vercel (no DB rollback).
4. **Env**: restore env vars from vault if a bad deploy changed configuration.
5. **Supabase**: DB recovery is separate (see below); redeploying Vercel does not restore data.

## 5. Migration rollback guidance

**There is no automatic down-migration.** Roll forward is the default safe path.

1. Identify the last known-good migration (e.g. `0037_spv_founder_rls_hardening.sql`) from git and `/admin/system-health`.
2. If a migration partially failed, use Supabase SQL editor to inspect state; do not run destructive `DROP` without a written plan.
3. Prefer **Supabase PITR** to a timestamp before the failed migration, then re-apply migrations from git in order.
4. Keep forward-fix migrations (`0038_...`) for corrections instead of editing applied SQL in place.

Repo migration order: `0001` through latest in `supabase/migrations/` (see `docs/supabase-setup.md`).

## 6. Incident recovery checklist

1. **Triage**: user impact, data integrity, auth, storage access.
2. **Stabilize**: disable affected feature flags or routes if needed (Vercel redeploy previous build).
3. **Database**: confirm Supabase status; restore from PITR if data corruption or bad migration.
4. **Storage**: verify buckets exist; re-upload critical documents from last manifest/export if needed.
5. **Secrets**: rotate `SUPABASE_SERVICE_ROLE_KEY` / Google OAuth if exposure suspected.
6. **Verify**:
   - `node scripts/check-production-env.mjs`
   - `./scripts/verify-backup.sh`
   - Sign-in smoke test (founder, investor, admin)
7. **Communicate**: internal post-mortem; log actions in `audit_logs`.

## 7. Operational scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/backup-db.sh` | `pg_dump` → `backups/db-*.sql.gz` |
| `scripts/backup-storage.sh` | Storage inventory manifest |
| `scripts/verify-backup.sh` | Validates latest local backup artifacts |
| `scripts/check-production-env.mjs` | Env validation (exit 1 on required gaps) |
| `scripts/export-operational-metadata.mjs` | JSON snapshot to `backups/` (no secrets) |
| `scripts/record-backup-event.mjs` | Writes backup events to `audit_logs` |

npm shortcuts:

```bash
npm run ops:check-env
npm run ops:backup-db
npm run ops:backup-storage
npm run ops:verify-backup
npm run ops:export-metadata
```

## 8. Admin operational visibility

- **UI**: `/admin/system-health` — backup & recovery checklist, migration file, buckets, Google status, recent backup audit events.
- **API**: `GET /api/admin/operations` (staff only) — same snapshot JSON, no secrets.

## 9. Monitoring backup failures

Backup scripts record events to `audit_logs`:

- `backup.database.completed` / `backup.database.failed`
- `backup.storage.manifest.completed` / `backup.storage.failed`
- `backup.verification.passed` / `backup.verification.failed`

Monitor via admin system health page or query `audit_logs` where `entity_type = 'backup'`.

## 10. Production launch checklist

- [ ] Supabase PITR / backups enabled on production project
- [ ] All migrations `0001`–latest applied
- [ ] `0037_spv_founder_rls_hardening.sql` applied
- [ ] `node scripts/check-production-env.mjs` passes for production env
- [ ] `./scripts/backup-db.sh` and `./scripts/verify-backup.sh` succeed
- [ ] Storage manifest generated; critical buckets verified
- [ ] Vercel production env documented in vault
- [ ] Google OAuth redirect URI matches production domain
- [ ] `/admin/system-health` shows recovery checklist green
- [ ] Incident owner and escalation path documented
