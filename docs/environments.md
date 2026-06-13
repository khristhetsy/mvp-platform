# CapitalOS environments

CapitalOS uses **three logical tiers**. Each tier should have its **own Supabase project** and **separate secrets**. Never point local development at production data.

## Tiers

| Tier | `APP_ENV` | Typical use | Supabase project | Vercel |
|------|-----------|-------------|------------------|--------|
| **Local development** | `local` | Daily engineering on your machine | **Dev** project (dedicated) | Not used (`npm run dev`) |
| **Staging** | `staging` | QA, migration rehearsal, stakeholder review | **Staging** project (dedicated) | Preview / staging deployment |
| **Production** | `production` | Live users | **Production** project | Production deployment |

### How `APP_ENV` is resolved

1. **`APP_ENV`** env var if set (`local` | `staging` | `production`)
2. Else **`VERCEL_ENV=production`** → `production`
3. Else **`VERCEL_ENV=preview`** → `staging`
4. Else **`NODE_ENV=development`** → `local`
5. Else default → `local` (including local `next build`)

Set `APP_ENV` explicitly on Vercel Production and Preview to avoid ambiguity.

---

## Local development

1. Copy `.env.local.example` → `.env.local`
2. Create or use a **dev Supabase project** (not production)
3. Apply migrations from `supabase/migrations/` in order (see `docs/supabase-setup.md`)
4. Run:

```bash
npm run dev
npm run check:env
```

Optional safety: set `CAPITALOS_PRODUCTION_SUPABASE_HOST=your-prod-ref.supabase.co` in `.env.local`. If `NEXT_PUBLIC_SUPABASE_URL` matches that host while `APP_ENV=local`, `npm run check:env` fails with a warning.

---

## Staging

**Purpose:** Validate migrations, auth, RLS, and flows before production.

**Supabase:** Separate staging project. Apply migrations here **before** production.

**Vercel:**

- Use a **Preview** deployment or a dedicated **staging** Vercel project
- Set environment variables from `.env.staging.example`
- Set `APP_ENV=staging`
- Set `NEXT_PUBLIC_APP_URL` to your staging URL (e.g. `https://staging.capitalos.com`)

**Google OAuth:** Register a staging redirect URI in Google Cloud Console matching `GOOGLE_REDIRECT_URI`.

---

## Production

**Supabase:** Production project only.

**Vercel:**

- Production environment variables from `.env.production.example`
- `APP_ENV=production`
- `NEXT_PUBLIC_APP_URL` = your live URL

**Never** commit production secrets. Configure them only in Vercel (or your host’s secret store).

---

## Testing migrations safely

1. **Local or staging first** — run new SQL in the staging Supabase SQL editor (or Supabase CLI linked to staging)
2. **Verify** — sign in, founder upload, investor interest, admin review, SPV read paths
3. **Backup production** — see `docs/backup-and-recovery.md` and `npm run ops:backup-db`
4. **Apply to production** — only after staging passes
5. **Smoke test production** — auth + one read/write per role

Migration files live in `supabase/migrations/` and must be applied in numeric order.

---

## Deploying safely

Follow **`docs/deployment-checklist.md`**.

Summary:

1. `npm run build` (or `npm run build:staging` / `npm run build:production`)
2. `npm run check:env` with target env vars loaded
3. Migrations on **staging** → full test pass
4. Backup **production** database
5. Migrations on **production**
6. Deploy to Vercel Production
7. Post-deploy smoke tests

---

## Environment files

| File | Purpose | Commit? |
|------|---------|---------|
| `.env.example` | Master template reference | Yes |
| `.env.local.example` | Local dev template | Yes |
| `.env.staging.example` | Staging template | Yes |
| `.env.production.example` | Production template | Yes |
| `.env.local` | Your local secrets | **No** (gitignored) |

---

## Admin visibility

Admins can view non-secret environment status at **`/admin/system-health`** (APP_ENV, app URL, Supabase host, service-role presence).

## Vercel Cron (orchestration + digests)

Set **`CRON_SECRET`** in Vercel (staging/production). Vercel Cron invokes `GET /api/cron/run-orchestration` with `Authorization: Bearer <CRON_SECRET>`.

Schedules are defined in `vercel.json` (7:00 and 19:00 UTC daily). Manual staff triggers remain available at `POST /api/admin/run-digest-pass` and `POST /api/admin/notification-orchestration`.

---

## Required environment variables (summary)

Public (client + server):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL` (optional legacy alias)

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (required for cron orchestration on staging/production)
- `TOKEN_ENCRYPTION_SECRET` (required if Google OAuth is enabled)
- `ANTHROPIC_API_KEY` (optional; assistant runs in fallback mode without it)

Google OAuth (if used):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run check:env` | Validate required variables for current `APP_ENV` |
| `npm run build:staging` | Production build with `APP_ENV=staging` |
| `npm run build:production` | Production build with `APP_ENV=production` |
| `npm run ops:check-env` | Alias of `check:env` |

---

## Security rules

- **`SUPABASE_SERVICE_ROLE_KEY`** — server-only; never in client bundles or `NEXT_PUBLIC_*`
- **Never commit** `.env.local` or real keys
- **Separate projects** per tier — dev/staging/prod Supabase must not share production data during development
