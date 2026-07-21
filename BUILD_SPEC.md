# CapitalOS — Build Specification

_Generated from the current repository state. Project: `mvp-platform` (v0.1.0). Branch: `main`. Last commit: 2026-06-22._

## 1. Stack & Runtime

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.6 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 (target ES2017, `strict`) |
| Styling | Tailwind CSS | v4 (`@tailwindcss/postcss`) |
| Database / Auth / Storage | Supabase (Postgres, `@supabase/ssr`) | js ^2.106.1 |
| ORM schema | Prisma (schema only; Postgres) | — |
| Testing | Vitest | ^4.1.8 |
| Error monitoring | Sentry (`@sentry/nextjs`) | ^10.57.0 |
| Analytics | PostHog + Vercel Analytics / Speed Insights | — |
| Payments | Stripe (+ LemonSqueezy config) | stripe ^22.2.0 |
| Email | Resend | — |
| AI | Anthropic Claude (haiku-4-5 / sonnet-4-6) | degrades gracefully w/o key |
| Reports | `pdfkit`, `pdf-lib`, `exceljs` (server-only) | — |
| Drag & drop | `@dnd-kit` | — |
| i18n | `next-intl` | ^4.13.0 |

**Node:** project builds on Node 20+ (sandbox verified on Node 22.22.3, npm 10.9.8). No `.nvmrc` / `engines` pin — recommend adding one.

## 2. Build & Run Commands

```bash
npm install              # install dependencies
npm run dev              # local dev server (http://localhost:3000)
npm run build            # production build (next build)
npm run build:staging    # build with APP_ENV=staging
npm run build:production # build with APP_ENV=production
npm run start            # serve the production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit (tsconfig.build.json)
npm run test             # Vitest (all)
npm run check:env        # validate env vars for current APP_ENV
```

Ops utilities: `ops:backup-db`, `ops:backup-storage`, `ops:verify-backup`, `ops:export-metadata`.

## 3. Environment Tiers

Three tiers, **each with its own Supabase project**: `local`, `staging`, `production`.

`APP_ENV` resolution order: explicit `APP_ENV` → `VERCEL_ENV=production` → `VERCEL_ENV=preview` (→ staging) → `NODE_ENV=development` (→ local) → default `local`.

Copy the matching example file before building:
`.env.local.example → .env.local`, `.env.staging.example`, `.env.production.example`.
**Never point local at the production Supabase project.**

### Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, non-local)
- `CRON_SECRET` (staging / production)

### Optional / feature-gated
- `ANTHROPIC_API_KEY` — AI diligence features (degrade gracefully if absent)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` + `TOKEN_ENCRYPTION_SECRET` — Google Calendar/Meet
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- Email: `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_DOMAIN`, `INBOUND_WEBHOOK_SECRET`
- Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Beta gating: `PRIVATE_BETA_MODE`, `NEXT_PUBLIC_PRIVATE_BETA_MODE`

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is server-only — never import `src/lib/supabase/admin.ts` from client code or expose via `NEXT_PUBLIC_*`.

## 4. Architecture Notes

- **Middleware** lives at `src/proxy.ts` (intentionally not `middleware.ts`). Guards `/founder/*`, `/investor/*`, `/admin/*` + API routes, reads `profiles.role` per request, enforces zone-based access, redirects unauthenticated users to `/auth/sign-in`.
- **Roles** (`profiles.role`): `founder`, `investor`, `admin`, `analyst`. Internal RBAC (`src/lib/rbac/`) layers granular permissions (`regular_user`, `manager`, `admin`, `super_admin`).
- **Supabase clients**: browser (`client.ts`), server/cookie (`server.ts`), service-role admin (`admin.ts`, server-only).
- **Subscriptions/feature gating**: `src/lib/subscriptions/plans.ts` — trial, founder basic ($499/mo), professional ($1,000/mo), investor free, admin internal.
- **Domain libraries** under `src/lib/`: auth, billing, compliance, spv, investor-crm, founder-crm, learning, matching, messaging, notifications, marketplace, deal-rooms, rbac, ai.
- **Next.js 16 caveat** (from `AGENTS.md`): breaking API changes vs. earlier versions — consult `node_modules/next/dist/docs/` before writing Next-specific code.

## 5. Database

- Migrations in `supabase/migrations/`, `0001` → `0068`, applied in numeric order (Supabase SQL editor or CLI). Run on staging + verify before production.
- Prisma schema (`prisma/schema.prisma`) defines enums/models (roles, company status, document types) against Postgres.
- See `docs/supabase-setup.md` and `docs/deployment-checklist.md`.

## 6. Deployment (Vercel)

- Deploys are **git-driven**: push `main` to GitHub → Vercel auto-builds the connected project. This local folder is **not** `.vercel`-linked.
- `vercel.json` cron jobs (require `CRON_SECRET`):
  - `POST /api/cron/run-orchestration` — 07:00 & 19:00 UTC
  - `POST /api/marketing/process-sequences` — every 15 min
  - `POST /api/cron/meeting-reminders` — every 15 min
- Sentry wraps the build (source maps hidden). PostHog + Vercel analytics client-side.

## 7. Recommended Pre-Deploy Checklist

1. `npm run check:env` (target tier) — confirm required vars present.
2. `npm run typecheck` — no type errors.
3. `npm run lint` — clean.
4. `npm run test` — green.
5. `npm run build:production` — succeeds locally.
6. Apply any new `supabase/migrations/*` to **staging**, verify, then production.
7. Commit → push `main` → confirm Vercel deploy + `/admin/system-health`.

## 8. Current Sync State (as of this spec)

- **Git:** remote `origin → github.com/khristhetsy/mvp-platform` is configured, but `main` has **no upstream** and nothing has been pushed from this copy — local commits (through 2026-06-22) are **not yet on GitHub**.
- **Vercel:** not linked locally; will only deploy once commits reach the connected GitHub repo.
- **Supabase:** migrations are local; apply via dashboard/CLI — no auto-sync.
- **Last compiled build:** `.next` BUILD_ID from 2026-06-18 (older than latest commit — rebuild needed to reflect June 21–22 work).
