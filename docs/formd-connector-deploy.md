# Form D Connector — Deployment Checklist

SEC EDGAR Form D → iCapOS CRM. Mirrors Form D filings, scores them as
capital-advisory leads, and lets admins promote qualified filings into Contacts.

> Run everything on **staging** first, verify, then repeat on **production**.
> Each tier is its own Supabase project (see `CLAUDE.md` → Environment Tiers).

---

## 0. Prerequisites

- Supabase project access (SQL editor + Edge Functions) for the target tier.
- Supabase CLI logged in (`supabase login`) and linked (`supabase link --project-ref <ref>`).
- A declared SEC contact string for the `User-Agent` header. EDGAR **rejects**
  requests without one. Format: `"iCFO Capital Global data@icfocapital.com"`.

---

## 1. Apply database migrations

Migrations `20260824001`–`20260824005` (in `supabase/migrations/`), in numeric order.

Via CLI:

```bash
supabase db push        # applies all pending migrations to the linked project
```

Or paste each file into the dashboard SQL editor in order.

`20260824005_formd_connector.sql` adds the `formd_cik` / `formd_accession_no`
columns + index to **`public.crm_contacts`** (the real CRM table) and the
`promoted_contact_id` FK. Confirm those exist after running:

```sql
select column_name from information_schema.columns
where table_name = 'crm_contacts' and column_name like 'formd_%';
-- expect: formd_cik, formd_accession_no
```

Verify the mirror tables + RLS:

```sql
select tablename from pg_tables where tablename like 'formd_%';
-- expect: formd_filings, formd_related_persons
select relrowsecurity from pg_class where relname = 'formd_filings';  -- expect: t
```

---

## 2. Set Edge Function secrets

The functions read these from the Deno env. Service role must have **no**
contacts write grant — only the admin promote path (server route) writes
`crm_contacts` (spec §10).

```bash
supabase secrets set \
  SEC_USER_AGENT="iCFO Capital Global data@icfocapital.com" \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

Also set `SEC_USER_AGENT` on the **Next.js app** env (Vercel) for the same
tier — the connector card's "Test connection" and the `/api/.../formd/test`
route use `process.env.SEC_USER_AGENT`. Without it the card shows
"User-Agent not set" and the test fails fast by design.

---

## 3. Deploy the Edge Functions

The runtime-agnostic domain logic lives in `src/lib/formd/*` (Node + vitest).
Deno can't import from `src/`, so a vendored copy already exists at
**`supabase/functions/_shared/formd/`** — same files with `.ts` import
extensions. If you change anything under `src/lib/formd/{types,dedupe,derive,parse,score,ingest}.ts`,
re-vendor (see §6) before deploying.

```bash
supabase functions deploy formd-ingest
supabase functions deploy formd-recompute
```

Smoke-test the ingest for a single past weekday (EDGAR posts the prior day):

```bash
curl -i -X POST \
  "https://<ref>.functions.supabase.co/formd-ingest?date=2026-08-21" \
  -H "Authorization: Bearer <service-role-key>"
# expect JSON: { date, indexed, parsed, upserted, notFound, errors }
```

Confirm rows landed and that **no related-person street** was stored:

```sql
select count(*) from formd_filings where date_filed = '2026-08-21';
select column_name from information_schema.columns
where table_name = 'formd_related_persons';   -- must NOT contain any street/zip column
```

---

## 4. Schedule with pg_cron

Run `supabase/functions/formd-ingest/cron.sql` in the SQL editor. It schedules:

- `formd-ingest`  → `0 7 * * 1-5` (07:00 UTC = 09:00 CET, weekdays)
- `formd-recompute` → `0 3 * * *` (nightly re-score of unpromoted filings)

The SQL uses `pg_cron` + `pg_net`; enable both extensions first if not already:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Before running, replace the placeholder project ref / service-role bearer in
`cron.sql` with the target tier's values. Then verify:

```sql
select jobname, schedule, active from cron.job where jobname like 'formd%';
```

---

## 5. Verify in the app

1. Sign in as an **admin**, go to **Admin → CRM → Connectors**.
2. The **SEC EDGAR — Form D** card shows: green "Configured" badge, stat tiles
   (Filings mirrored / Operating / Funds / Unpromoted), and health chips.
3. Click **Test connection** → "Connected to EDGAR."
4. **Review filings →** opens the review screen. Confirm the saved-view tabs
   (Promote-eligible / Stall window / Aging in / Agent watch / All) show counts.
5. Promote one eligible filing → a `crm_contacts` row is created with the
   Entrepreneur Information pre-filled; the row shows **Promoted ✓**.
6. Sign in as an **analyst** — the card and review screen are read-only
   (no Promote buttons; filing links only).

---

## 6. Re-vendoring the shared library (only if `src/lib/formd/*` changes)

```bash
cd <repo root>
for f in types dedupe derive parse score ingest; do
  sed -E 's#(from ["'"'"'])\./([a-zA-Z]+)(["'"'"'])#\1./\2.ts\3#g' \
    "src/lib/formd/$f.ts" > "supabase/functions/_shared/formd/$f.ts"
done
```

`store.ts` and the `*.test.ts` files are **not** vendored — `store.ts` is
server-only (uses the service-role Supabase client) and the tests are Node/vitest.

---

## Rollback

- Cron: `select cron.unschedule('formd-ingest'); select cron.unschedule('formd-recompute');`
- Functions: `supabase functions delete formd-ingest formd-recompute`
- Data: the mirror tables are additive; dropping them does not touch existing
  contacts. Promoted contacts keep `formd_cik` / `formd_accession_no` for audit.
```
