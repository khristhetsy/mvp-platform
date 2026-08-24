# SEC Form D Connector — Operating Guide

How to run the Form D lead pipeline day to day. This is the "how do I use it"
guide; the one-time install steps live in `formd-connector-deploy.md`.

---

## What it does, in one paragraph

Every weekday morning the connector reads the SEC's daily Form D index, pulls
each new filing, scores it as a capital-advisory lead (0–100), and mirrors it
into iCapOS. You review the scored filings and **promote** the good ones into
CRM Contacts with the Entrepreneur Information pre-filled. SEC EDGAR stays the
system of record — the connector never writes back to the SEC, and promoting a
filing is the only thing that ever creates a contact.

---

## Where it lives

**Admin → CRM → Connectors.** The **SEC EDGAR — Form D** card sits below the
Odoo connector. From there:

- The card shows live counts (Filings mirrored / Operating / Funds / Unpromoted)
  and a health strip.
- **Test connection** → confirms EDGAR is reachable.
- **Review filings →** opens the working screen.

Who can do what:

- **Admin** — full: review, promote, bulk-promote, resolve matches, hold.
- **Analyst** — read-only: sees scores and filing links, no Promote buttons.

---

## Daily routine (5 minutes)

1. Open **Admin → CRM → Connectors** and glance at the card. If the User-Agent
   badge is green ("Configured") and "Filings today" isn't flagged red, the
   overnight run worked.
2. Click **Review filings →**. It opens on the **Promote-eligible** view.
3. Work top-down — the list is sorted by score. For each filing worth pursuing,
   click **Promote**. Green **Promoted ✓** confirms a contact now exists.
4. Use **bulk promote** (tick the rows, then "Promote selected") when several
   are clearly good.
5. Anything you're unsure about, leave it — you can revisit it any day; nothing
   expires.

---

## The saved-view tabs (what each one is for)

Each tab is a pre-built filter; the count next to it updates live.

- **Promote-eligible** — the daily work queue. Operating companies (not funds),
  no placement agent, at least $1M still to raise, score ≥ 70, not yet promoted.
  Start here.
- **Stall window** — score ≥ 70, no agent, 90–365 days since first sale. These
  raised a while ago and may still need help closing — warm re-approach targets.
- **Aging in** — 60–89 days since first sale, ≥ $1M remaining. Leads about to
  enter the stall window; get ahead of them.
- **Agent watch** — filings that already have a placement agent. Informational —
  these are usually already represented, so they're kept out of the work queue.
- **All filings** — everything mirrored, no filter. Use for search/spot-checks.

The **Min score** box (top-right) tightens or loosens the threshold on the
score-based views. All filtering happens instantly against the mirror — it never
re-hits EDGAR.

---

## Reading a row

- **Score (0–100)** — capital-advisory fit. Green ≥ 80, blue ≥ 70, grey below.
  Built from: amount still to raise, funding stage, whether a placement agent is
  present (agents lower the score — they're already advised), recency of first
  sale, investor type, and 506(c) status.
- **Company** — name, location, form type (D or D/A), derived investor type.
- **Remaining** — dollars still to raise, and % already sold.
- **Days** — days since first sale ("no sale" if none has occurred yet).
- **Stage** — derived funding stage (Seed / Series A / …). May be blank when the
  filing lacks the data to derive one — that's expected, not an error.
- **Flags** — `fund`, `agent`, `506(c)`.

---

## Promoting — what happens

When you click **Promote**, the connector runs a dedupe cascade before creating
anything:

1. **Same company already promoted (matched by CIK)** → it **updates** that
   contact's still-to-raise figure and note instead of making a duplicate.
2. **A contact with the same name + phone exists** → it stops and asks. You get
   two buttons on the row:
   - **Link** — attach this filing to that existing contact.
   - **Create anyway** — make a new contact regardless.
3. **No match** → it **creates** a new contact: name, company, phone, city/state,
   `Lead source = SEC Form D`, membership `Entrepreneur`, status `new`, and the
   Entrepreneur Information block filled from the filing (entity type, capital
   sought, revenue range, management team, funding stage, investor type).

Promoted filings show **Promoted ✓** linking straight to the CRM record.

---

## Monitoring health

The card's health strip surfaces problems the SEC won't announce (a silent
outage looks just like a quiet filing day). Chips turn amber/red when:

- **Filings today = 0 on a weekday** → the morning run may have failed. Re-run it
  manually (see below) and check.
- **Company-name null rate > 2%** or **Related-persons = 0 rate > 30%** → the
  parser may be drifting from a changed EDGAR format. Ping whoever maintains the
  connector.
- **Phone null rate high** → informational; some filers just omit phone.

---

## Running it manually (backfill or recovery)

The scheduled jobs run 07:00 UTC weekdays (ingest) and 03:00 UTC nightly
(re-score). To pull a specific day yourself — e.g. after a failed morning, or to
backfill history — POST the ingest function with a date. It's idempotent (upsert
by accession number), so re-running a day is always safe.

Single day:

```bash
curl -s -X POST \
  "https://raowjbhbtmwkycmwvavd.functions.supabase.co/formd-ingest?date=2026-08-21" ; echo
# expect: {"indexed":N,"parsed":N,"upserted":N,"notFound":0,"errors":0}
```

Backfill a range of weekdays:

```bash
for d in 20260811 20260812 20260813 20260814 20260817 20260818 20260819 20260820 20260821; do
  curl -s -X POST \
    "https://raowjbhbtmwkycmwvavd.functions.supabase.co/formd-ingest?date=${d:0:4}-${d:4:2}-${d:6:2}" ; echo
done
```

Re-score unpromoted filings (normally the nightly job; run if you changed scoring):

```bash
curl -s -X POST "https://raowjbhbtmwkycmwvavd.functions.supabase.co/formd-recompute" ; echo
```

---

## Quick sanity checks (SQL editor)

```sql
-- how many filings are mirrored
select count(*) from public.formd_filings;

-- today's top leads
select company_name, formd_score, derived_funding_stage, days_since_first_sale, has_placement_agent
from public.formd_filings
order by formd_score desc nulls last limit 20;

-- is the schedule active?
select jobname, schedule, active from cron.job where jobname like 'formd%';

-- who's been promoted
select company_name, promoted_at, promoted_contact_id
from public.formd_filings where promoted_contact_id is not null order by promoted_at desc;
```

---

## If something looks wrong

- **Card says "User-Agent not set"** → the `SEC_USER_AGENT` env var is missing on
  the app (Vercel) or the functions. Set it and redeploy; without it the job
  refuses to hit EDGAR (SEC requires a declared contact).
- **"Filings today: 0 on a weekday"** → run the manual ingest for that date. If
  it returns `indexed: 0` but the SEC clearly has filings, the parser needs a
  look.
- **A promote errored** → the message shows on the screen. Most often a transient
  DB hiccup; retry. If it says "Filing not found," refresh the list.
- **Duplicate-looking contacts** → that's the possible-match path working; use
  **Link** next time instead of **Create anyway**.
```
