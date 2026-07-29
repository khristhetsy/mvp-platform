# Odoo investor/founder profile fields — data cleanup

## Why this matters

iCapOS scores investor↔founder matches from the structured "Additional details"
fields synced from Odoo (investment size, use of funds, deals/year, revenue &
EBITDA ranges, active rating, etc.). Matching only works if each investor's
selections are **specific to that investor**.

Right now many investors carry the **same full set of options on every field**
(e.g. every investor is tagged with *all four* investment-size bands). When a
field is identical across everyone it carries no signal, so it can't rank anyone
— the match falls back to neutral. The iCapOS admin **Investor match** page now
flags exactly which fields are affected ("N fields ignored for scoring …").

The iCapOS sync is correct — it imports each partner's *actual* selected values,
not the option list. So this is an **Odoo data** issue to fix in Odoo; once the
selections are real, the next sync carries them through automatically with no
iCapOS change.

## Confirm the diagnosis (2 minutes)

1. Open two different investor contacts in Odoo (e.g. Kevin Wang and one other).
2. Look at the "Investor Profile" tab → "Investor investment size?" (and the
   other preference fields).
3. If **both** investors have the *same, full* set of bands, that confirms the
   blanket-tagging. If they differ, tell the iCapOS team — that would indicate a
   read bug instead.

## What to clean up (Odoo side)

For `res.partner` records with Membership = Investor (and Entrepreneur), fix
these Studio fields so each record holds only its **real** answer(s):

| Field (label) | Should hold |
|---|---|
| Investor investment size? | The band(s) the investor actually writes checks in — usually 1–2, not all |
| Investor preferences for use of funds? | The stages/uses they back |
| Investor preferences for the number of deals per year? | Their real cadence |
| Investor preferences for … annual revenue range of? | The revenue band(s) they target |
| Investor preferences for … annual EBITDA range of? | The EBITDA band(s) they target |
| Investor preferences for the management team? | Their real preference(s) |
| Active investor / rating fields | Their real rating |

For founders (Entrepreneur Profile): the "Seeking type of investor(s)",
"Seeking type(s) of capital", "Seeking amount of capital", and "Use of funds"
fields should reflect that founder's raise, not all options.

### How to clean

- **Preferred:** correct the values per record (bulk edit in a list view grouped
  by the field, or via an export → edit → import round-trip on the `x_studio_*`
  columns).
- **Root cause:** if a Studio automation or import default is setting every
  option on create, disable/adjust it so new records don't repopulate the full
  set. Otherwise the blanket tags will return after cleanup.

## After cleanup

- Trigger a contact sync (or wait for the scheduled `sync-contacts` cron).
- Reopen the iCapOS **Investor match** page and pick a company — the amber
  "fields ignored" banner should shrink or disappear, and match scores should
  spread out instead of clustering.
