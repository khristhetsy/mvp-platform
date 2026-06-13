# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # local dev server
npm run build                  # production build
npm run build:staging          # build with APP_ENV=staging
npm run build:production       # build with APP_ENV=production
npm run lint                   # ESLint
npm run test                   # run all tests (vitest)
npm run test:watch             # vitest in watch mode
npm run check:env              # validate env vars for current APP_ENV

# single test file
npx vitest run src/lib/ai.test.ts

# ops scripts
npm run ops:backup-db
npm run ops:export-metadata
```

## Architecture

### Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind v4**
- **Supabase**: Auth, Postgres, Storage, SSR (`@supabase/ssr`)
- **Vitest** for unit tests (`src/**/*.test.ts`)
- **Sentry** (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)
- **PostHog** for product analytics
- **Anthropic Claude** (`claude-haiku-4-5-20251001` / `claude-sonnet-4-6`) for all AI features — gracefully degrades without `ANTHROPIC_API_KEY`
- `pdfkit` and `exceljs` for report generation (server-only)
- `@dnd-kit` for drag-and-drop in admin UIs

### Routing & Middleware

The middleware lives at **`src/proxy.ts`** (not `middleware.ts` — this is intentional). It:
- Guards `/founder/*`, `/investor/*`, `/admin/*` and their API counterparts
- Reads the user's `profiles.role` from Supabase on every protected request
- Enforces zone-based role access: founders can't reach `/investor/*`, etc.
- Redirects unauthenticated users to `/auth/sign-in?next=<path>`
- On unconfigured Supabase env, redirects to `/configuration-error` (production) or passes through (local)

### User Roles & RBAC

**Workspace roles** (stored in `profiles.role`): `founder`, `investor`, `admin`, `analyst`
- `admin` and `analyst` both access the admin workspace
- Role home routes: `/founder/dashboard`, `/investor/dashboard`, `/admin/dashboard`

**Internal RBAC** (`src/lib/rbac/`) adds granular permissions on top of the admin role:
- Role slugs: `regular_user`, `manager`, `admin`, `super_admin`
- Permissions: `manage_users`, `assign_roles`, `manage_page_builder`, `manage_companies`, etc.
- Legacy staff (admin/analyst without an RBAC row) get `LEGACY_STAFF_PERMISSIONS` automatically

### Supabase Client Pattern

- **Client components**: `src/lib/supabase/client.ts` → `createClient()` (browser client)
- **Server components / Route Handlers**: `src/lib/supabase/server.ts` → `createServerSupabaseClient()` (cookie-based)
- **Admin operations**: `src/lib/supabase/admin.ts` → service role client (server-only, never import in client code)
- Types are generated in `src/lib/supabase/types.ts`

### Subscription & Feature Gating

Plans live in `src/lib/subscriptions/plans.ts`:
- `founder_trial` (3-day), `founder_basic` ($499/mo), `founder_professional` ($1,000/mo), `investor_free`, `admin_internal`
- Feature keys: `dashboard`, `ai_diligence`, `documents`, `readiness`, `investor_access`, `capital_raise`, `elearning`, `analytics`, `premium_tools`, `investor_workspace`, `settings`
- `FounderFeatureGate` and `InvestorFeatureGate` components enforce access in UI
- `src/lib/subscriptions/access.ts` and `founder-access.ts` for server-side checks

### Domain Library (`src/lib/`)

Each subdirectory maps to a platform domain. Key ones:

| Directory | Domain |
|-----------|--------|
| `auth/` | Signup role selection, session helpers |
| `billing/` | Pricing guards, upgrade requests, billing status |
| `compliance/` | Risk scanning, event logging, escalations |
| `spv/` | SPV lifecycle — checklist → open → participations → requirements → closing |
| `investor-crm/` | Investor pipeline, interest stages, CRM timelines |
| `founder-crm/` | Founder contact management, outreach campaigns |
| `learning/` | Courses, lessons, progress, badges, quizzes, spaced repetition |
| `matching/` | Founder ↔ investor matching logic |
| `messaging/` | Thread-based messaging, meeting scheduling |
| `notifications/` | Notification orchestration, digests |
| `marketplace/` | Campaign publication, deal discovery |
| `deal-rooms/` | Deal room phase 1 |
| `rbac/` | Internal role/permission system |
| `ai.ts` | Claude AI diligence report generation |
| `env.ts` | Environment helpers (`getAppEnv()`, `validateRequiredEnv()`, etc.) |

### Environment Tiers

Three tiers, each with its **own Supabase project**: `local`, `staging`, `production`.

`APP_ENV` resolution order: explicit `APP_ENV` env var → `VERCEL_ENV=production` → `VERCEL_ENV=preview` → `NODE_ENV=development` → defaults to `local`.

Copy the appropriate `.env.*.example` file:
- Local dev: `.env.local.example` → `.env.local`
- Never point local at the production Supabase project

Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server, non-local), `CRON_SECRET` (staging/production).

Optional: `ANTHROPIC_API_KEY` (AI features degrade gracefully without it), `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `TOKEN_ENCRYPTION_SECRET` (Google Calendar/Meet integration).

### Database Migrations

Migrations live in `supabase/migrations/` (currently `0001` through `0068`), applied in numeric order via the Supabase dashboard SQL editor or CLI. Always run on staging and verify before applying to production. See `docs/supabase-setup.md` and `docs/deployment-checklist.md`.

### Vercel Cron

`vercel.json` schedules `GET /api/cron/run-orchestration` at 07:00 and 19:00 UTC. Requires `CRON_SECRET` env var. Manual staff triggers: `POST /api/admin/run-digest-pass` and `POST /api/admin/notification-orchestration`.

### Key Conventions

- `src/proxy.ts` is the Next.js middleware (exported with `config.matcher`)
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never import `admin.ts` from client components or `NEXT_PUBLIC_*`
- AI features use Anthropic Claude (`src/lib/claude.ts`) and return a fallback response when `ANTHROPIC_API_KEY` is absent
- Admin environment status (non-secret) visible at `/admin/system-health`
- Test files follow `src/**/*.test.ts` naming; mock Supabase client at `src/test/mock-supabase.ts`

> **Note (from AGENTS.md):** This project uses Next.js 16 App Router, which has breaking changes from earlier versions. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the current API.
