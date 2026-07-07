# Feature Registry Proposal — Departments (Phase 0)

**Status:** AWAITING HUMAN REVIEW. No schema, seed, or code has been written. Per the build brief §2, Phase 1 does not start until this list is approved/edited.

**Method:** Scanned the admin nav registry (`src/lib/workspace-nav.ts`) and walked every `page.tsx` under `src/app/admin`. Cross-referenced menu ↔ route. Founder/Investor areas excluded by design (departments are internal-only, additive).

**Hubs:** `general_admin` · `investor_relations` · `marketing` · `sales` (matches the mockup's four departments: Admin / Investor Relations / Marketing / Sales).

---

## Repo-specific findings that affect later phases (flagging now)

1. **Middleware lives at `src/proxy.ts`, not `middleware.ts`** (intentional, per CLAUDE.md). Phase 3 enforcement goes there.
2. **An RBAC permission system already exists.** Every nav item carries a `requiredPermission` (e.g. `manage_crm`, `manage_marketing`); roles are `regular_user | manager | admin | super_admin` with `LEGACY_STAFF_PERMISSIONS`. The brief's "existing platform admin role" = `admin`/`super_admin`. **Departments must layer *inside* this, not replace it** — the outer `role`/permission gate stays. Worth confirming we're not duplicating RBAC.
3. **Feature Controls already exists** at `/admin/feature-controls` (feature *flags* via `loadFeatureFlags`/`isFeatureEnabled`). The brief's "Global Features (existing)" tab = this page; "Departments/Members/Audit" are new tabs beside it. Good news — the shell exists.
4. **Registry-driven nav (Phase 4) is the highest-risk change.** The internal nav is one big typed array with `requiredPermission` gating already working. Replacing it with a DB-registry renderer touches every admin page's sidebar. Recommend we scope Phase 4 as "filter the existing nav array by `get_user_features`" rather than a full rewrite — lower risk, same outcome. Decision needed.
5. **`/admin/operations-hub` is retired** (we repointed Operations Hub → `/admin/playbook` earlier). Its route files still exist but aren't in nav → treat as orphan/legacy, exclude.

---

## Proposed feature registry

`source`: nav = in menu · route = page exists · both = menu+route.
`flags`: `NEEDS_DECISION` (ambiguous hub) · `orphan_route` (route, no menu — excluded pending decision) · `broken_nav` (menu, no route).

### general_admin

| key | label | path | source | flags |
|---|---|---|---|---|
| admin_dashboard | Dashboard | /admin | both | |
| operations_hub | Operations Hub | /admin/playbook | both | |
| companies | Companies | /admin/companies | both | NEEDS_DECISION (general vs IR) |
| investors_directory | Investors | /admin/investors | both | NEEDS_DECISION (general vs IR) |
| action_center | Action Center | /admin/actions | both | |
| tasks | Tasks | /admin/tasks | both | |
| portfolio | Portfolio | /admin/portfolio | both | |
| readiness | Readiness Scores | /admin/readiness | both | |
| diligence_tracker | Diligence Tracker | /admin/data-room | both | |
| diligence_review | Diligence Review | /admin/diligence | both | |
| learning | Learning | /admin/learning | both | |
| events | Events | /admin/events | both | NEEDS_DECISION (general vs marketing) |
| operations_manual | Operations Manual | /admin/manual | both | |
| analytics | Analytics | /admin/analytics | both | |
| reports | Reports | /admin/reports | both | |
| insights | Insights | /admin/insights | both | |
| funnels | Activation Funnels | /admin/funnels | both | |
| compliance | Compliance | /admin/compliance | both | |
| audit | Audit | /admin/audit | both | |
| voice | Voice (consent/campaigns/perf/calls) | /admin/voice | both | NEEDS_DECISION (general vs marketing) |
| inbox | Inbox | /admin/inbox | both | |
| calendar | Calendar / Schedule / Meet | /admin/calendar | both | |
| signatures | E-Signatures | /admin/signatures | both | |
| user_management | User Management | /admin/users/manage | both | admin-only in practice |
| user_permissions | User Permissions | /admin/users/permissions | both | admin-only |
| feature_controls | Feature Controls | /admin/feature-controls | both | admin-only |
| billing | Billing | /admin/billing | both | admin-only |
| system | System (integrations/queues/automation/health/imports) | /admin/integrations | both | admin-only |
| profile | My Profile | /admin/profile | both | everyone |

### investor_relations

| key | label | path | source | flags |
|---|---|---|---|---|
| ir_crm | IR CRM (Activity/Pipeline/Messages/Outreach) | /admin/crm | both | |
| founder_crm | Founder CRM | /admin/crm/founders | both | NEEDS_DECISION (IR vs sales) |
| investor_crm | Investor CRM | /admin/crm/investors | both | |
| crm_unclassified | Unclassified | /admin/crm/unclassified | both | |
| contact_sync | Contact Sync | /admin/crm/connectors | both | |
| intro_requests | Intro Requests | /admin/intro-requests | both | |
| deal_rooms | Deal Rooms | /admin/deal-rooms | both | |
| spvs | SPVs | /admin/spvs | both | |
| matching | Matching | /admin/matching | both | |
| partner_scores | Partner Scores | /admin/partner-scores | both | |

### marketing

| key | label | path | source | flags |
|---|---|---|---|---|
| marketing_hub | Marketing Hub (Dashboard/Console/Plan/Analytics/AEO/Settings…) | /admin/marketing | both | |
| marketing_contacts | Marketing Contacts | /admin/marketing/contacts | both | |
| marketing_lists | Lists | /admin/marketing/lists | both | |
| marketing_campaigns | Campaigns | /admin/marketing/campaigns | both | |
| marketing_sequences | Sequences | /admin/marketing/sequences | both | |
| marketing_templates | Templates | /admin/marketing/templates | both | |
| marketing_suppressions | Suppressions | /admin/marketing/suppressions | both | |

*(All `/admin/marketing/*` sub-routes gate under the `marketing_hub` path prefix; listed separately only where useful to toggle independently.)*

### sales

| key | label | path | source | flags |
|---|---|---|---|---|
| sales_hub | Sales Hub (Dashboard) | /admin/sales | both | |
| sales_contacts | Contacts | /admin/sales/contacts | both | |
| sales_opportunities | Opportunities | /admin/sales/opportunities | both | |
| sales_pipeline | Pipeline | /admin/sales/pipeline | both | |
| sales_tasks | Tasks | /admin/sales/tasks | route | orphan_route (not in nav) |
| sales_settings | Settings | /admin/sales/settings | both | |

---

## Orphan routes (exist but NOT in nav) — human decision required, NOT auto-included

| path | likely hub | note |
|---|---|---|
| /admin/dashboard | general_admin | Duplicate of `/admin`? Confirm which is canonical. |
| /admin/crm/audience | investor_relations | CRM tool, unlinked |
| /admin/crm/brief | investor_relations | CRM tool, unlinked |
| /admin/crm/classify | investor_relations | CRM tool, unlinked |
| /admin/crm/publish | investor_relations | CRM tool, unlinked |
| /admin/crm/verify | investor_relations | CRM tool, unlinked |
| /admin/crm/record/:id | investor_relations | record detail |
| /admin/marketing/prospects | marketing | unlinked marketing page |
| /admin/marketing/aeo/visibility | marketing | AEO sub-tool |
| /admin/learning/analytics | general_admin | unlinked |
| /admin/learning/approvals | general_admin | unlinked |
| /admin/learning/certificates | general_admin | unlinked |
| /admin/operations-hub (+ /lifecycle, /settings) | — | **Retired** — exclude. |
| /admin/page-builder-lab | general_admin | in nav as "Page Builder" under System — actually covered |
| /admin/beta-operations | general_admin | in nav under System — covered |

Detail routes (`/…/:id`, `/…/new`, `/events/:id/*`, `/signatures/:id/*`) inherit their parent feature's gate via longest-prefix match — not registered separately.

---

## Decisions I need from you before Phase 1

1. **Ambiguous hubs (NEEDS_DECISION):**
   - `companies`, `investors_directory` → general_admin or investor_relations?
   - `events` → general_admin or marketing?
   - `voice` (campaigns/consent/etc.) → general_admin or marketing?
   - `founder_crm` → investor_relations or sales?
2. **Orphan routes:** include any of the CRM tools (audience/brief/classify/publish/verify), marketing/prospects, or learning sub-pages? Or leave unregistered (Admin-only until linked)?
3. **`/admin/dashboard` vs `/admin`** — which is canonical?
4. **Phase 4 nav approach:** filter the existing nav array by `get_user_features` (lower risk, recommended) vs. full DB-registry renderer (brief's literal ask)?
5. **RBAC overlap:** confirm departments layer *inside* the existing `requiredPermission` system rather than replacing it.
6. **Starter grants:** the brief seeds grants empty (fail-closed). Do you want a reviewed starter set (e.g. IR dept → all `investor_relations` features on; Marketing → marketing; Sales → sales) so those teams aren't locked out on day one?

Once you confirm 1–6 (edits welcome), I'll proceed to Phase 1 (migration + RLS + audit triggers + seed).
