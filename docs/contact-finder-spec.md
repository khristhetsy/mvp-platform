# Contact Finder: Build Spec

**Owner:** Khris Thetsy
**Date:** 2026-10-05
**Repo:** iCFO CapitalOS
**Status:** Step 1 live (see 4.10). Step 2 built on `feat/contact-finder-v2` (see 5.9). Step 3 deferred (decision 2026-10-06).
**Mockups:** `docs/mockups/contact-finder-mockups.html` (7 screens)

## 1. Summary

The Marketing Hub already has a contact finder (Prospects → Verify → "Find missing info" and "Verify all contacts"). This spec replaces its weak parts with the new design and adds the missing features. It runs in three build steps:

- **Step 1. Fix what is wrong today.** Seven verified defects, three of which write bad data into `crm_contacts` with no human review.
- **Step 2. Add the new features on Vercel (Option A).** Domain pattern learning, lookup log, find rate by source, compliance fields, retention, suppression gate, optional Apollo provider.
- **Step 3. Add a mailbox verification worker outside Vercel (Option B).** Real SMTP check and catch-all detection. Optional; Steps 1 and 2 do not depend on it.

Each step ships on its own branch and PR. Every migration is shown for approval before it runs (CLAUDE.md rule).

## 2. Current system (as verified on 2026-10-05)

| Piece | File | What it does |
|---|---|---|
| UI, Verify stage | `src/app/admin/marketing/prospects/VerifyContactList.tsx` | Lists contacts, "Verify selected/all", "Find missing info" (single and bulk, max 25), Accept/Reject suggestions |
| Suggest API | `src/app/api/prospects/suggest/route.ts` → `src/lib/verify/suggest.ts` | Returns candidates, writes nothing |
| Accept API | `src/app/api/prospects/accept-suggestion/route.ts` | Writes accepted value to `crm_contacts` |
| Bulk worker | `src/app/api/contacts/verify/route.ts` → `src/lib/verify/store.ts` | Verifies given email AND appends found email/phone, **writes directly** |
| Email check | `src/lib/verify/email.ts` | Syntax → MX lookup → role detection. No mailbox check |
| Pattern guess | `src/lib/append/pattern.ts` | 6 formats from name + domain |
| Site scrape | `src/lib/append/site.ts` | Robots-aware fetch of homepage, regex for emails/phones |
| Web search | `src/lib/append/websearch.ts` | Serper or Google CSE, budget-gated, finds company contact pages |
| Suppression | `marketing_unsubscribes` table, `crm_contacts.suppressed` | Used by sending, **not by the finder** |

Relevant `crm_contacts` columns (migration `20260704003_prospect_pipeline_columns.sql`): `email_status` (`unverified|valid|risky|invalid`), `email_source` (`given|site|profile|provider`), `phone_source` (no check), `contact_confidence` (0..100), `enrichment_status` (`pending|enriched|no_website|failed`), `company_domain`, `suppressed`.

## 3. Verified defects

D1 to D5 were reproduced by running the repo's own code on 2026-10-05 (DNS lookups run from a cloud workspace; the Mac sandbox has no DNS). D6 and D7 were confirmed by reading the code.

| # | Defect | Reproduction | Effect |
|---|---|---|---|
| D1 | "valid" means only that the domain has MX records | `verifyEmail("zz-no-such-person-48213@stripe.com")` → `{status:"valid", confidence:75}` | Any invented address at a real company shows as Valid |
| D2 | Pattern step always returns the first candidate | All 6 candidates share one domain, so `v.mx` is true for the first. `Jane Doe @ stripe.com` → `jane@stripe.com` every time | 5 of 6 formats are never chosen |
| D3 | Accented names are mangled | `inferEmails("José Álvarez")` → `jos.lvarez@`; `"Jean-Luc Ménard"` → `mnard@` | Wrong guesses for French and Spanish names |
| D4 | Company inbox stored as the person's email | `extractContacts` on a footer with `info@acmefund.com` returns it; `store.ts` writes `site.emails[0]` to the contact | Bulk run saves `info@` as Jane Doe's email, unreviewed |
| D5 | Non-phone numbers parsed as phones | Same footer returned `20260512 1234` as a phone; homepage phones are marked `confident: true` | Bad phones saved by the bulk run; switchboards shown as confident |
| D6 | Finder ignores suppression | No reference to `marketing_unsubscribes` or `suppressed` in `src/lib/verify` or `src/lib/append` | Opted-out people get looked up again |
| D7 | Guessed emails can be sent | `match-campaign/fields.ts:79` excludes only `email_status === "invalid"`; pattern guesses are stored as `risky` | The "never cold-send a guess" rule in `pattern.ts` is not enforced |

## 4. Step 1: Fix the defects

**Branch:** `fix/contact-finder-defects`
**Migration:** M1 only (small).

### 4.1 Email verification levels (D1)

Do not change the meaning of `email_status` values; other code (campaign filters, segments) reads them. Add a separate verification level instead.

- **M1** adds `crm_contacts.email_check_level text check (email_check_level in ('none','syntax','domain','mailbox')) default 'none'`.
- `verifyEmail` returns `level: "syntax" | "domain"` (and `"mailbox"` once Step 3 exists).
- A non-role address with MX keeps `status: "valid"` but gets `level: "domain"` and **confidence 50** (down from 75).
- UI label in `VerifyContactList.tsx`: `valid + domain` shows **"Domain OK"** (amber); `valid + mailbox` shows **"Mailbox confirmed"** (green). Update the `EMAIL_COLOR` map and the Confirm card copy ("Emails checked" → "Domains checked; mailboxes are not confirmed").

### 4.2 Pattern selection (D2)

- Remove the `for … if (v.mx) break` loop in both `suggest.ts` and `store.ts`.
- Check MX **once** for the domain. If no MX, stop.
- Choose the candidate by this order:
  1. A learned pattern for the domain (Step 2, `email_domain_patterns`), if one exists.
  2. Otherwise the global format ranking (Step 2), defaulting to `first.last`, then `flast`, `first`, `firstlast`, `f.last`, `first_last`, `last.first`, `firstl`.
- Return **one** suggestion with `source: "profile"`, `confident: false`, and a note naming the format, e.g. "Pattern first.last (unverified)". Show the other candidates in a collapsed "Other formats" row so the user can pick one.

### 4.3 Name normalization (D3)

In `pattern.ts`, normalize before stripping:

```ts
const clean = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z\s'-]/g, "");
```

- Hyphenated given names produce both `jean-luc` and `jeanluc` variants.
- Strip apostrophes from local parts (`o'brien` → `obrien`).
- Drop particles only when generating the `last` token for `flast` (keep `de`, `van` etc. as a second candidate).

### 4.4 Role inboxes are never assigned to a person (D4)

- `extractContacts` keeps returning all emails, but callers filter: an email whose local part is in `ROLE_LOCALPARTS` (extend the set with `contact-us`, `enquiries`, `inquiries`, `ir`, `investors`, `partners`, `bonjour`, `accueil`) is **never** suggested as the person's email.
- Prefer a scraped email whose local part matches the person's name tokens (any of first, last, initial+last). If none matches, add no email suggestion from the site.
- Store found role inboxes on the company, not the contact (Step 2, `email_domain_patterns.role_inbox`).

### 4.5 Phone parsing (D5)

- Add the dependency `libphonenumber-js` (not currently in `package.json`) and replace the regex with it (`parsePhoneNumberFromString`, `isValid()`), using the contact's country if known, else `FR` for `.fr` domains and `US` otherwise.
- Reject numbers that match a date shape (`^(19|20)\d{6}`) before parsing.
- Store in E.164.
- Phones from a site or web search are **company lines**: `confident: false`, note "Company line, not a direct number".

### 4.6 Bulk worker stops writing unreviewed data (D4, D5)

`store.ts processRows` keeps verifying the **given** email and writing `email_status`. It stops writing appended `email` and `phone`. Instead it writes candidates to `contact_finder_suggestions` (Step 2 table; for Step 1, keep them in the existing in-memory suggestion flow and show "N contacts have suggestions, review them"). Until Step 2 lands, the bulk run only verifies; appending happens through the reviewed "Find missing info" flow.

### 4.7 Suppression gate (D6)

New `src/lib/verify/suppression.ts`:

```ts
export async function isSuppressed(db, c: { id: string; email: string | null; suppressed?: boolean }): Promise<boolean>
```

True when `crm_contacts.suppressed` is true, or the email (lowercased) is in `marketing_unsubscribes`. Called first in `suggestForContact`, `processRows` and `acceptSuggestion`. A suppressed contact returns `reason: "Contact opted out. Not looked up."`, and `acceptSuggestion` throws.

### 4.8 Send gate for guessed emails (D7)

- New helper `isSendable(row)` in `src/lib/marketing/match-campaign/fields.ts`: false when `email_status` is `invalid`, or when `email_source = 'profile'` (pattern guess) and `email_check_level <> 'mailbox'`.
- Replace the check at `fields.ts:79` and audit every other send path (`process-sequences`, `mass-email`, `partner-sequences`, event email) to use the same helper. List each path changed in the PR.
- Excluded rows report reason `"unconfirmed_guess"` so the campaign preview shows how many were held back.

### 4.9 Step 1 acceptance criteria

- **Test:** `verifyEmail` on an invented address at a real domain returns `level: "domain"`, `confidence: 50`.
- **Test:** pattern selection for `Jane Doe @ stripe.com` with no learned pattern returns `jane.doe@stripe.com`, and with a learned `flast` pattern returns `jdoe@stripe.com`.
- **Test:** `inferEmails("José Álvarez", "fund.fr")` includes `jose.alvarez@fund.fr`; `"Jean-Luc Ménard"` includes `jean-luc.menard@` and `jeanluc.menard@`.
- **Test:** a site page containing only `info@acmefund.com` produces no email suggestion for Jane Doe.
- **Test:** the footer string `20260512 1234` yields no phone; `+1 (858) 555-0100` yields `+18585550100`.
- **Test:** a contact whose email is in `marketing_unsubscribes` gets no lookup and accept throws.
- **Test:** `processRows` no longer changes `email` or `phone` on any row.
- **Test:** `checkFounder` returns `"unconfirmed_guess"` for a `risky` row with `email_source = 'profile'`; existing `match-campaign.test.ts` cases still pass.
- Tests live beside the modules (`src/lib/verify/*.test.ts`, `src/lib/append/*.test.ts`); DNS is mocked with `vi.mock("node:dns/promises")`.
- Checks per CLAUDE.md: `npx tsc --noEmit`, `npx vitest related --run <changed>`, `npm run lint`, `npm run build`.

### 4.10 Step 1 as built (2026-10-05)

Built on branch `fix/contact-finder-defects`. Changes from the plan above, with the reason for each:

| Planned | Built | Why |
|---|---|---|
| Migration M1 (`email_check_level` column) | No migration in Step 1 | Without the Step 3 worker every check is domain-level, so the column would hold one value. `verifyEmail` returns `level` in code; M1 moves to Step 3 |
| `libphonenumber-js` dependency | Dependency-free `normalizePhone` in `site.ts` | `package-lock.json` is already out of sync with `package.json` (`npm ci` fails on missing `chokidar@3.6.0`); adding a dependency would widen that diff |
| New excluded reason `unconfirmed_guess` | Guesses reported as `email_unverified` | `match_campaign_founders.excluded_reason` has a CHECK constraint (`20261004140000_match_campaign_cooldown.sql`); a new value needs a migration |
| `email_source` read from the match campaign view | Read from `crm_contacts` in `loadFounderFields` | The view `match_campaign_founder_fields` has no `email_source` column |

Found during the independent review and fixed in the same branch:

- **More send paths gated (D7):** saved prospect lists (`prospects/lists.ts`) and segment publishing (`publish/store.ts`) now exclude guesses too, alongside mass email, sequences, lists from contacts, CRM sync and match campaigns.
- **Verify all drains:** the queue now skips empty emails, orders by id, and a contact found on the unsubscribe list is flagged `suppressed = true` so it leaves the queue.
- **Company inboxes blocked server side:** `acceptSuggestion` refuses `info@`-style addresses even on a direct API call.
- **Stricter person matching:** a scraped address must be one of the person's name formats or contain both first and last name, so a colleague with the same surname is not matched.
- **Name handling:** letters like Ł, ø, đ are transliterated; titles (Dr, Mme) and suffixes (Jr, PhD) dropped; "Smith, John" read as John Smith.
- **Phones:** written dates (05.12.2026) rejected, "(858) 555-0100" captured whole, bare digit runs accepted only from `tel:` links.
- **Source labels kept:** the bulk worker no longer relabels every address as `given`, which had been erasing the guess marker.

Left as is, outside Step 1:

- `src/lib/contacts/linkedin-enrich.ts` still writes a company phone and a name-matched email found by web search straight to the contact. It has its own duplicate and company-inbox handling. Move it onto the review flow in Step 2.
- One-to-one sends from a contact page (`src/lib/ir/send-email.ts`) are not gated: a person sees the address before sending.
- Historical data: the old bulk worker relabeled earlier guesses as `given`, so they can't be told apart now, and `info@`-style addresses it saved remain on contacts. A read-only count is in the PR notes.

## 5. Step 2: New features on Vercel (Option A)

**Branch:** `feat/contact-finder-v2`
**Migration:** M2 (new tables, RLS on, explicit policies in the same file).

### 5.1 Data model (M2)

```sql
-- Learned email format per company domain
create table if not exists public.email_domain_patterns (
  domain text primary key,
  pattern text not null,                       -- e.g. 'first.last'
  verified_samples int not null default 0,      -- given or mailbox-confirmed emails that fit
  conflicting_samples int not null default 0,
  catch_all boolean,                            -- null = unknown (Step 3 fills it)
  role_inbox text,                              -- e.g. info@acme.com, never assigned to a person
  last_checked_at timestamptz not null default now()
);

-- One row per lookup attempt, per source (powers find rate and audit)
create table if not exists public.contact_lookups (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  source text not null check (source in ('pattern','site','web','apollo','manual_kaspr','smtp')),
  field text not null check (field in ('email','phone')),
  outcome text not null check (outcome in ('found','not_found','error','skipped_suppressed','skipped_budget')),
  value text,
  run_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_lookups_source_idx on public.contact_lookups (source, created_at desc);

-- Suggestions awaiting review (replaces in-memory state; bulk runs write here)
create table if not exists public.contact_finder_suggestions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  field text not null check (field in ('email','phone')),
  value text not null,
  source text not null,
  confident boolean not null default false,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  unique (contact_id, field, value)
);

-- Provenance and retention on the contact
alter table public.crm_contacts
  add column if not exists data_source_note text,          -- e.g. 'Conference attendee list, Sept 2026'
  add column if not exists lawful_basis text
    check (lawful_basis in ('legitimate_interest','consent','existing_relationship')),
  add column if not exists found_at timestamptz,            -- when a finder value was accepted; never reset by edits
  add column if not exists retention_expires_at timestamptz;

alter table public.email_domain_patterns enable row level security;
alter table public.contact_lookups enable row level security;
alter table public.contact_finder_suggestions enable row level security;
-- Service role only, matching the Sales Hub enrichment tables: no client policies.
-- Admin and analyst access goes through API routes that call requireRole(["admin","analyst"]).
```

Also widen `email_source` to include `'apollo'` if Apollo ships (5.6).

After applying: `npm run db:types`.

### 5.2 Domain pattern learning (mockup screen 5)

New `src/lib/append/domain-patterns.ts`:

- `learnFromKnownEmails()`: for every `crm_contacts` row with `email_source = 'given'`, a name, and a non-free domain, detect which format the local part matches. Upsert `email_domain_patterns` with the majority format. A domain needs **2 or more** matching samples and **zero** conflicts to count as learned; otherwise `pattern` is stored but the UI shows "(unconfirmed)".
- Runs: once as a backfill (admin button "Learn patterns from existing contacts"), then incrementally whenever an email is accepted or given.
- `rankFormats()`: the global order used in 4.2 is the frequency of each format across learned domains, falling back to the default order when fewer than 20 domains are learned.
- This is the main accuracy gain available on Vercel: it uses emails iCFO already has (the ~12,000 lead list) instead of guessing.

### 5.3 Lookup cascade (mockup screen 6, "Lookup order")

`suggestForContact` becomes, in order, logging a `contact_lookups` row per source:

1. **Suppression gate** (4.7). Log `skipped_suppressed`.
2. **Learned domain pattern** (5.2). If learned, one confident-ish suggestion: `confident: false`, note "Company format first.last, learned from N contacts".
3. **Company site** (homepage, then the `COMMON_PATHS`), name-matched emails only (4.4), validated phones (4.5).
4. **Web search** to company pages (existing, budget-gated). Log `skipped_budget` when the AI budget blocks it.
5. **Ranked pattern guess** (4.2).
6. **Apollo** (5.6), only if enabled and the earlier sources found nothing.
7. **Manual Kaspr**: no API. The UI offers "Log a manual reveal" (5.7).

Suggestions persist to `contact_finder_suggestions`. Accept and Reject update the row's `status`.

### 5.4 Screens

Map the mockups onto the existing Prospects stepper rather than a new top-level page.

| Mockup screen | Where it goes | Notes |
|---|---|---|
| 1. Dashboard | New "Overview" tab at top of the Verify stage, replacing the current stat cards in `VerifyClient` | KPIs from `contact_lookups`; find rate per source = `found / (found + not_found)` over the selected period |
| 2. Single lookup | Expand the existing per-row suggestion panel in `VerifyContactList.tsx` | Add "Other formats" row and lawful basis picker on Accept |
| 3. Bulk upload | Existing `CreateListWizard` / `ImportStep.tsx` | Add "Source of this list" (`data_source_note`) and lawful basis as required fields at import |
| 4. Results | Existing contact list in `VerifyContactList.tsx` | Add Source and Found columns; add "Pending review" filter backed by `contact_finder_suggestions` |
| 5. Domain patterns | New sub-tab under Verify: `src/app/admin/marketing/prospects/DomainPatterns.tsx` | Table of `email_domain_patterns`, backfill button |
| 6. Free providers | `src/app/admin/marketing/settings` new "Contact finder" section | Apollo toggle and usage meters; key lives in env, never in the DB or UI |
| 7. Compliance | Same settings section | Retention period, notice text, export one person's data |

The mockup's dummy numbers are placeholders. Every figure on these screens must come from `contact_lookups` or the provider's own usage endpoint.

### 5.5 Compliance controls (mockup screen 7)

Based on the issues the CNIL cited against Kaspr (December 2024): collecting contact details users had restricted, a retention clock that restarted on each update, no notice until 2022, and vague answers to access requests.

- **Lawful basis required:** `acceptSuggestion` and list import reject a write without `lawful_basis`.
- **Source recorded:** every accepted value writes `email_source` / `phone_source` and the list's `data_source_note`.
- **Retention:** on accept, set `found_at = now()` and `retention_expires_at = found_at + setting` (default 12 months). Later edits **never** move `found_at`. A daily cron (`vercel.json`) finds expired rows that were never contacted and **clears the finder-sourced fields** (`email` when `email_source <> 'given'`, `phone` when `phone_source` is set). It does not delete the contact. It lists affected contacts for an admin to approve before clearing.
- **Access requests:** "Export one person's data and source" produces JSON of the contact's fields plus their `contact_lookups` history.
- **Notice:** the first-contact footer text (EN and FR) is stored as a setting and inserted by the existing MJML footer pipeline for contacts whose `email_source <> 'given'`.
- **No restricted sources:** the finder never reads LinkedIn or any logged-in page. The existing LinkedIn "Find" link stays a search link that the user opens.
- Counsel should confirm the default retention period and notice wording before go-live.

### 5.6 Apollo provider (optional, behind a flag)

- `src/lib/append/providers/apollo.ts`, enabled only when `APOLLO_API_KEY` is set and the settings toggle is on.
- **Verify before building:** confirm in Apollo's current docs whether the free plan includes API access and which endpoint and credit cost apply to email and mobile reveals. Published free allowance (third-party sources, 2026): 10,000 email credits per year and 120 mobile credits. If the free plan has no API access, ship 5.7's manual import for Apollo instead and skip this module.
- Called only after steps 1 to 5 find nothing. Spend is logged to `contact_lookups` and to the existing AI budget service under category `enrichment`.

### 5.7 Manual reveal log (Kaspr, or Apollo without API)

- "Log a manual reveal" on a contact row: paste email and/or phone, pick the source, lawful basis required. Creates an accepted suggestion with `source = 'manual_kaspr'` (or `'manual_apollo'`).
- Optional CSV import of reveals keyed by email or LinkedIn URL.

### 5.8 Step 2 acceptance criteria

- **Test:** backfill learns `first.last` for a domain with two `given` emails in that format and none conflicting; a domain with one sample stays unconfirmed.
- **Test:** every cascade source writes exactly one `contact_lookups` row per attempt.
- **Test:** find rate per source on the dashboard equals `found / (found + not_found)` computed directly in SQL for the same period.
- **Test:** accept without `lawful_basis` returns 400.
- **Test:** editing a contact after accept leaves `found_at` unchanged.
- **Test:** the retention job selects only expired, never-contacted rows and clears only finder-sourced fields.
- **Test:** with `APOLLO_API_KEY` unset, the Apollo step is skipped and logs nothing.
- Manual check: run the backfill on staging and report the share of domains learned (actual number, from the data).

### 5.9 Step 2 as built (2026-10-06)

Decisions taken 2026-10-06: no Step 3 for now; retention 12 months (placeholder until counsel confirms); the Odoo lead list (`odoo` and `odoo-ir`) recorded as legitimate interest; Apollo's free plan has no usable API (API access starts on the Basic plan per DataMagnet, Sept 2026), so 5.6 is replaced by the manual reveal log in 5.7.

| Planned | Built | Why |
|---|---|---|
| 5.6 Apollo API provider | Not built; manual reveal log covers Apollo and Kaspr | No API on the free plan; no paid tools |
| 5.5 notice text in the MJML footer | Not built | Touches every send template; needs counsel's wording first |
| 5.4 "Source of this list" and lawful basis at import | Lawful basis is chosen on the Verify screen and on each accept/reveal; import fields not built | Import wizard is shared with other flows; one decision at a time |
| Move `linkedin-enrich.ts` onto the review flow | Not built | That module was being changed in parallel (#183); left for its owner |
| `lawful_basis` overwritten on each accept | Recorded only when the contact has none | A pre-selected page default must not overwrite a recorded basis such as consent |
| `retention_expires_at` recomputed on each accept | Set once with `found_at`; a settings change applies to new values only | The clock must never move once started |
| "Never contacted" = lead_status new | lead_status new AND the found email never placed on a marketing send list (`marketing_contacts`) | Only segment publishing advances lead_status; other send paths don't |
| Pending review filter | Saved suggestions reload with each page of contacts | Same outcome without a second list query |

Also: accept and manual reveal keep working before the migration runs (provenance is skipped until the columns exist); rejecting the top format guess makes the next run offer the next format; choosing an alternative format logs the saved value as accepted and the original guess as rejected.

## 6. Step 3: Mailbox verification worker (Option B, optional)

**Why outside Vercel:** a mailbox check opens an SMTP session on port 25. The repo's own note in `email.ts` records that serverless blocks port 25. Most cloud hosts also block outbound port 25 by default; confirm the chosen host allows it before building.

**Branch:** `feat/smtp-verify-worker`

### 6.1 Worker

- Separate small Node service (`services/smtp-verify/`, not deployed to Vercel), one HTTPS endpoint `POST /verify { emails: string[] }`, authenticated with a shared secret in `SMTP_VERIFY_SECRET`.
- For each address: resolve MX, connect to the lowest-priority MX on port 25, `EHLO` with a real hostname that has matching reverse DNS, `MAIL FROM:<verify@<iCFO sending domain>>`, `RCPT TO:<address>`, then `QUIT`. **Never send `DATA`.** No mail is sent.
- **Catch-all detection:** per domain, also `RCPT TO` a random address (`zz-<random>@domain`). If it is accepted, the domain is catch-all: store `email_domain_patterns.catch_all = true` and report the result as "accepts all", never "Mailbox confirmed".
- Result codes: 250 → `mailbox`; 550/551/553 → `invalid`; 4xx, greylisting or timeout → `unknown` (retry once after 15 minutes, then leave as `domain`).
- Throttle: at most 1 connection per domain at a time and 20 checks per domain per hour. Cache per-domain results for 7 days.

### 6.2 Integration

- `verifyEmail` calls the worker when `SMTP_VERIFY_URL` is set, else behaves as Step 1 (`level: "domain"`).
- `mailbox` → `email_status = 'valid'`, `email_check_level = 'mailbox'`, confidence 90. Catch-all → `valid`, `level = 'domain'`, confidence 50, note "Domain accepts all addresses".
- Pattern selection gains a step: when the domain is not catch-all, test candidates in ranked order and pick the first one the server accepts. This is the only step that turns a guess into a confirmed address.

### 6.3 Step 3 acceptance criteria

- **Test (worker, mocked SMTP server):** 250 maps to `mailbox`, 550 to `invalid`, 451 to `unknown`; a domain accepting the random address is flagged catch-all.
- **Test:** the worker never issues `DATA`.
- **Test:** with `SMTP_VERIFY_URL` unset, all Step 1 and 2 tests still pass.
- Manual check on staging: run 50 known-good `given` emails through the worker and report how many return `mailbox`. Use that measured rate, not an assumed one, in any UI copy.

## 7. Out of scope

- Scraping LinkedIn or any page behind a login.
- Buying phone data in bulk, or any paid plan (Khris: no paid tools).
- Sending to pattern-guessed addresses without a mailbox check (blocked by 4.8).

## 8. Open questions

| # | Question | Needed by |
|---|---|---|
| Q1 | Ship Step 3 (needs a host that allows port 25)? | Before Step 3 |
| Q2 | Does Apollo's free plan include API access? (Check Apollo docs.) | Before 5.6 |
| Q3 | Retention period and notice wording, confirmed with counsel | Before Step 2 go-live |
| Q4 | Default lawful basis for the existing ~12,000 lead list import | Before the backfill in 5.2 |

## 9. Delivery order

| Step | Branch | Migration | Depends on |
|---|---|---|---|
| Step 1 | `fix/contact-finder-defects` | M1 | Nothing |
| Step 2 | `feat/contact-finder-v2` | M2 | Step 1 merged; Q3, Q4 |
| Step 3 | `feat/smtp-verify-worker` | None (uses M1/M2 columns) | Step 2 merged; Q1 |
