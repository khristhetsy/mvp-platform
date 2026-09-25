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

## UI conventions — the house design

These are the platform's agreed patterns. **Every new dashboard, card, list and
search must use them.** Don't invent a parallel design; if something here doesn't
fit a new surface, say so rather than building a one-off.

### Metric tiles — `MetricCard` / `OperationalMetric`

Never hand-roll a KPI card. Every metric tile on every dashboard (admin, founder,
investor, and all hubs) uses `MetricCard`, which gives:

- **`ring`** — a `ScoreRing` for scale. A metric with a real 0–100 or an x-of-y
  denominator gets a filled arc; one with **no ceiling** gets `pending: true`,
  which draws a dashed ring rather than a fake proportion. `gate` draws a
  threshold tick so a score reads as a distance (CRR against `OUTREACH_GATE`).
- **`unit`** — the denominator beside the value ("of 42", "gate 65").
- **`flag`** — one coloured line (`good` / `warn` / `bad`) carrying the fact that
  changes what you'd do today. **Omit it when the number behind it isn't loaded**;
  never invent a statistic to fill the slot.
- **`detailPanel`** — opens `MetricDetailDrawer` with the breakdown the tile has
  no room for, plus a link to act. Tiles without one keep `href` navigation.
- **`audience`** — `admin` / `founder` / `investor`, addresses the AI explanation.

Every drawer carries the on-demand AI explainer (`POST /api/metrics/explain`):
fetched on click, never on render; returns null when the tile has no supporting
context; the prompt is given only the displayed figures and may not invent any.

A bare number is not acceptable. "14" tells nobody anything — "14 open of 18
tracked · 4 high priority" does.

### Cards and sections

- Actions live in the **card's own header, right-aligned**, secondary → primary,
  with any count badge to their left. `WorkspaceSection` takes an `action` prop.
  Never float an action inside the body, and never give the same action two
  entry points on one screen.
- Section bodies hold content only.

### Search

Every list search uses `src/lib/ui/live-search.ts` + `components/ui/SearchStatus.tsx`:

- **Filters as you type.** `OdooSearchBar` debounces the typed text into `q`.
- **The count reflects the filter** — "6 of 23", never the unfiltered total.
- **Matches are highlighted** (`Highlight`), and an empty result uses
  `NoSearchMatches`, which names the fields that were searched.
- Searchable fields must cover **every column the table shows**, not a subset.

### Honesty rules that apply to all of the above

- A status nobody measures is **not** "done". Show it as unmeasured and name the
  query that would measure it.
- Never show a control that cannot run — if an action would fail, don't render it
  at full prominence.
- Provenance on any derived figure: where it came from and when.

## Working with khris

- Mockup first: show a mockup and wait for "build it" before writing code.
- Don't offer to build. Never end a reply with "say build it" / "want me to build this?".
  Building happens only when khris says so, or after the plan has been agreed. Until then,
  answer the question and stop.
- Only change what khris explicitly asks for — don't touch working code.
- Once building has started, fix errors rather than reporting them. Don't ask "shall I fix
  this?", don't ask "shall I carry on?", and don't hand khris a git command to repair
  something Claude can repair itself. Finish the job, then report what was done.
- khris runs all SQL in the Supabase SQL editor himself; never print `supabase db push`
  (the CLI's migration history is out of sync with the editor-applied schema and it errors);
  no paid upgrades.
- Never enter credentials or authenticate on anyone's behalf; never store passwords anywhere.
- Read the consumer before writing the component. Check whether the parent is `"use client"`
  before making a component async, check the type before adding a field to a loader, and check
  the call site before changing a signature. `tsc` does not catch an async server component
  rendered from a client one — most of the avoidable errors here come from writing first.
- Never propose a destructive diagnostic (`git revert`, deleting state, resetting data) for a
  cause already traced to something outside the code. Say what the evidence shows and stop.

## Shipping

Claude never runs `git add` / `git commit` / `git push`, `supabase db push`, or a Vercel
deploy. Every change ends with a `## Ship it` section that prints the commands for khris
to run — see the rule below (also available as the `/ship` command).

@.claude/ship-output.md

## Verification and product rules

Repo for **iCapOS** (product), owned by **iCFO Capital Global, Inc.** (parent company). Two-sided capital readiness SaaS: founders get a Capital Readiness Rating, investors get an Investor Fit Score. A Stop hook (`.claude/hooks/verify.sh`) runs the checks below whenever TypeScript files changed.

### Stack (summary)

- Next.js App Router + TypeScript
- Supabase (Postgres, Auth, RLS, Storage)
- Vercel (hosting and deploys)

### Verify your work (IMPORTANT)

A task is not done until all of these pass. Run them yourself and read the output. Do not report success based on the code "looking right".

```bash
npx tsc --noEmit        # type check, must be zero errors
npm run lint            # lint, must be zero errors
npm run build           # run before any change touching routing, config, or server components
```

- If a check fails, fix the cause. Do not silence it with `// @ts-ignore`, `eslint-disable`, or `any` unless I approve it.
- For UI changes, run `npm run dev` and describe what changed on screen, or take a screenshot if a browser tool is available.
- After any schema change, regenerate types:
  `npx supabase gen types typescript --project-id raowjbhbtmwkycmwvavd --schema public > src/lib/supabase/database.types.ts`
  Never write generated output to `src/lib/supabase/types.ts`: it is hand-maintained and imported by ~280 files. (The `db:types` npm script currently targets that file; do not run it until it is repointed.)
- When you finish, list which checks you ran and their result.

### Database rules

- **Migrations: show before running.** Write the migration file, show me the SQL, and wait for approval before applying it. Never apply a migration unasked.
- Every new table gets RLS enabled and explicit policies in the same migration.
- CRM ownership is scoped through the `contact_assignees` junction table (multi assignee). Respect it in queries and policies.
- Investor matching sources investors from Investor Contact records, not the Investor CRM. `investor_profiles` and `prospect_investors` are separate tables; do not merge them.

### Naming rules

- Pre-score field is always `lead_prescore`. Never `crr`. The rubric lives in `/lib/prescore/rubric.ts`.
- The `organizations.type` enum value `SPV` stays as is in the back end. In user facing UI it is labeled **"Deal Company"**.
- Product name in UI copy is "iCapOS". Do not write "CapitalOS" in user facing text.

### Behavior rules

- **AI features draft, humans confirm.** Any AI agent or assistant inside iCapOS may draft content but must never write to or mutate tables without explicit user confirmation.
- **Demo and internal Founder accounts never send real email.** Distribution sends and introduction requests from these accounts must not dispatch to real investors. Check this whenever you touch email, distribution, or intro request code.
- **Document uploads are PDF only**, with a user facing message on rejection. Logos, pitch video, avatars, and contact imports keep their own formats.
- No transactions or fund movement anywhere on the platform. Pledges and indications of interest only.

### Brand

- Colors: navy `#0A1A40`, blue `#1A6CE4`, hover/active `#2E78F5`, steel secondary `#185FA5`
- Type: Archivo (headlines), Inter (body), IBM Plex Mono (mono)
- Teal `#0D9488` is legacy. Do not use it in the app.

### Working style

- For anything beyond a small fix, propose a short plan first and wait for a go ahead.
- Keep changes scoped to the task. Do not refactor unrelated files.
- Never commit secrets. Environment variables go in `.env.local` and Vercel project settings.
