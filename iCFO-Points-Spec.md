# iCFO Points — Product & Technical Spec

_Display name is **iCFO Points**. Internal module, tables, and functions keep the `credit_*` / `Credit*` names (e.g. `credit_ledger`, `awardCredits`, `CREDITS_ENABLED`, `/credits`) to avoid churn and a name clash with the existing per-event `event_points`. Only user-facing copy says "Points."_

_Status: draft to guide implementation. Build stays behind a feature flag and unlinked from public nav until counsel signs off (see terms doc)._

## 1. Goal & model

Turn gamification participation into **iCFO Credits** — a closed-loop, no-cash-value loyalty balance the user carries across events and redeems for a fixed menu of iCFO services. Display is **Credits only** (e.g. "250 Credits"), never a "$" value.

Key principle: Credits are a **separate, user-level ledger**, funded 1:1 from the existing per-event points at the moment they're earned. Points (`event_points`) stay exactly as they are (per-event status + leaderboard); Credits accumulate globally per profile.

## 2. Existing system to integrate with

- `event_points (event_id, profile_id, action, ref, points)` — unique `(event_id, profile_id, action, ref)`, written by `awardPoints()` in `src/lib/icfo-events/gamification.ts` (idempotent, best-effort).
- `event_point_rules (action, points)` — configurable values; defaults in `POINT_VALUES`.
- Actions: `register`, `session_viewed`, `applied`, `approved`, `networking_optin`, `connection_accepted`.

**Integration point:** inside `awardPoints()`, after the `event_points` upsert succeeds, also write a credit ledger entry for the same `points` amount, idempotent on the same identity. One code change, no new call sites.

## 3. Data model (new tables)

```
credit_ledger
  id            uuid pk default gen_random_uuid()
  profile_id    uuid not null references profiles(id) on delete cascade
  delta         integer not null            -- + earn, - redeem/expire/reverse
  reason        text not null               -- 'earn:register', 'redeem', 'expire', 'reversal', 'adjust'
  ref           text not null default ''     -- idempotency key (e.g. eventId:action:ref for earns)
  event_id      uuid null references events(id) on delete set null
  redemption_id uuid null
  created_at    timestamptz not null default now()
  expires_at    timestamptz null            -- for earn entries, when they lapse
  unique (profile_id, reason, ref)           -- earns idempotent; redeems use unique ref (redemption id)

credit_catalog                              -- redeemable services
  id           uuid pk
  title        text not null
  description  text null
  cost         integer not null check (cost > 0)
  active       boolean not null default true
  sort         integer not null default 0
  created_at   timestamptz default now()

credit_redemptions
  id           uuid pk
  profile_id   uuid not null references profiles(id)
  item_id      uuid not null references credit_catalog(id)
  title        text not null               -- snapshot at redemption time
  cost         integer not null            -- snapshot
  status       text not null default 'fulfilled'  -- 'fulfilled' | 'reversed'
  created_at   timestamptz default now()
```

Balance = `sum(delta)` over `credit_ledger` for the profile (optionally excluding expired). Add index `(profile_id)` and `(profile_id, created_at)`.

## 4. RLS

- `credit_ledger`, `credit_redemptions`: user can **select own rows** (`profile_id = auth.uid()`); **no client insert/update/delete** — all writes go through the service role in server code.
- `credit_catalog`: `select` where `active` for any authenticated user; full write restricted to `manage_events` permission (service role in admin routes).

## 5. Lib API (`src/lib/icfo-events/credits.ts`)

```
awardCredits(profileId, amount, reason, ref, opts?) : Promise<void>   // idempotent, best-effort, service role
getBalance(supabase, profileId) : Promise<number>
getLedger(supabase, profileId, limit?) : Promise<CreditEntry[]>
listCatalog(supabase, activeOnly=true) : Promise<CreditItem[]>
redeem(profileId, itemId) : Promise<{ ok: true; redemptionId } | { ok:false; error }>   // checks balance, writes redemption + negative ledger
// admin
createCatalogItem / updateCatalogItem / setCatalogActive
reverseRedemption(redemptionId)   // credits back, marks reversed
```

`redeem` guards: item active, `balance >= cost`; writes a `credit_redemptions` row then a `credit_ledger` delta of `-cost` with `reason='redeem'`, `ref=redemptionId`. Do it server-side under the service role; re-read balance immediately before insert to avoid overspend (acceptable for MVP; a Postgres function/trigger can harden later).

## 6. Earning integration

In `awardPoints(eventId, profileId, action, ref)`: after the points upsert, call
`awardCredits(profileId, points, 'earn:'+action, eventId+':'+action+':'+ref, { eventId, expiresAt })`.
Same idempotency key shape → no double credit on retries. Best-effort (never throws).

## 7. Redemption flow (user)

1. Wallet page `/credits` (auth required): shows **Credits balance**, recent ledger history, and the active catalog with a **Redeem** button per item (disabled if balance < cost).
2. Redeem → `POST /api/credits/redeem { itemId }` → `redeem()` → returns new balance + redemption id.
3. Fulfillment for MVP: record the redemption and show "Redeemed — our team will apply [service] to your account." (Manual/most services.) Automated grants (e.g., unlock a tool) can be added per catalog item later.

## 8. Wallet UI (Credits only)

- Header: big "**{balance} Credits**" + subtext "No cash value · redeemable for iCFO services".
- Tabs/sections: **Redeem** (catalog grid) and **History** (ledger: +earned / −redeemed with date and reason label).
- Link to `/legal/credits` terms.
- Never render a "$" or dollar figure.

## 9. Admin

- `/admin/events/credits` (or a section in the existing Gamification page): manage the Rewards Catalog (add/edit/deactivate items, set Credit cost), view recent redemptions, reverse a redemption, and a manual adjust (grant/deduct with reason) for support.
- Guarded by `manage_events` permission.

## 10. Expiration (phase 2)

A scheduled pass (reuse the Vercel cron) writes negative `expire` ledger entries for earn lots past `expires_at` that haven't been spent (FIFO). MVP can ship without expiry and add it before Credits accrue materially.

## 11. Safeguards / open items

- Feature flag `CREDITS_ENABLED`; page + nav hidden until on.
- Per-user / program caps to bound liability (config).
- Abuse: rely on existing points idempotency; add rate limits on redeem.
- Analytics events: `credit_earned`, `credit_redeemed`.
- **Do not** add any earn action tied to investing, or any catalog item that offsets deal/investment cost (terms §5, §10).

## 12. Build order

1. Migration (tables + RLS + indexes).
2. `credits.ts` lib + types.
3. Hook `awardCredits` into `awardPoints`.
4. `POST /api/credits/redeem` + admin catalog API.
5. `/credits` wallet page + admin catalog UI.
6. Typecheck, lint, feature-flag off by default.
