# CapitalOS Enterprise Architecture Audit

**Document type:** Read-only architectural and workflow assessment  
**Platform:** CapitalOS (`mvp-platform`)  
**Audit date:** May 2026  
**Scope:** Full platform — admin, founder, investor, API, public, database, operations, UX, security, scalability, AI readiness  

> **Audit constraint:** This document is analysis and documentation only. No production logic, schema, UI, packages, workflows, or migrations were modified to produce it.

---

## Executive Summary

CapitalOS is a **multi-workspace institutional readiness and capital formation platform** built on Next.js 16 (App Router), React 19, Supabase (Auth + Postgres + Storage), and a growing domain library under `src/lib/`. It serves three primary personas — **founders**, **investors**, and **admin/analyst staff** — across onboarding, diligence, marketplace discovery, CRM, compliance, SPV operational tracking, imports/exports, and reporting.

The platform demonstrates **strong domain modeling** (especially SPV lifecycle, compliance queues, and founder readiness) and **recent operational maturity investments** (admin queues, universal operational activity events, query-param drill-downs, import/export center). Enterprise readiness is **mid-stage**: operationally capable for a controlled MVP/early institutional pilot, but not yet a cohesive enterprise command platform due to fragmented audit/event systems, incomplete RBAC enforcement, list-centric admin entity UX, and uneven instrumentation depth.

**Current stage:** **Growth-stage operational MVP → early enterprise pilot**  
**Recommended posture:** Stabilize cohesion and security (Tier 1) before scaling intelligence (Tier 3).

---

## 1. Platform Overview

### 1.1 What CapitalOS Is

CapitalOS is an **AI-assisted due diligence and capital readiness platform** that helps founders prepare for institutional review, get published to a curated marketplace, engage investors through controlled CRM and messaging, and track **non-binding SPV operational workflows** (checklists, investor document intake, closing readiness). Admins operate a **command center** for company/investor review, compliance escalation, queue-based operations, reporting, and bulk data movement.

**Positioning signals in code:**
- Operational disclaimers on SPV surfaces (“not legal formation or securities execution”)
- Compliance center framed as internal institutional controls, not legal advice
- Readiness scoring, remediation, learning, and outreach gated by plan tier and approval state
- Staff-only internal notes and audit trails on sensitive workflows

### 1.2 Major Workflows

| Workflow | Primary actors | Core outcome |
|----------|----------------|--------------|
| Founder onboarding & readiness | Founder, Admin | Company profile, documents, AI diligence, remediation |
| Company review & publishing | Admin, Founder | `review_status`, marketplace visibility |
| Investor onboarding & approval | Investor, Admin | `approval_status`, gated sensitive actions |
| Marketplace & deal discovery | Investor, Public | Approved listings, personalized matching |
| Platform CRM | Investor, Founder, Admin | Interests, intros, saved deals, pipeline stages |
| Founder private CRM & outreach | Founder | Contacts, campaigns, social drafts (compliance-gated) |
| Messaging & meetings | Founder, Investor | Thread-based communication, meeting scheduling |
| SPV operational lifecycle | Admin, Investor, Founder | Checklist → open → participations → requirements → packages → closing |
| Compliance & risk | Admin, System scanners | `compliance_events`, escalations, keyword/outreach flags |
| Admin operations queues | Admin, Analyst | Seven virtual queues → filtered module drill-downs |
| Imports / exports | Admin | Batch CSV/XLSX with preview, validation, audit |
| Reporting & analytics | Admin, Founder, Investor | PDF/CSV exports, workspace analytics |
| Learning & remediation | Founder | Courses, quizzes, auto-generated remediation tasks |
| Billing & subscriptions | Founder, Investor | Trial, upgrade requests, feature gates |

### 1.3 Core Operational Modules

```
┌─────────────────────────────────────────────────────────────────┐
│                     CapitalOS Platform Layer                     │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Identity   │  Marketplace │     CRM      │    Compliance      │
│  RBAC/Auth   │  Campaigns   │  Interests   │  Events/Scanners   │
│  Profiles    │  Deals       │  Intros      │  Risk phrases      │
│  Subscriptions│ Matching    │  Messaging   │  Escalations       │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│              SPV Operations (checklist → closing)                │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Readiness  │   Learning   │  Outreach    │  Imports/Reports   │
│  Remediation │   Video AI   │  Campaigns   │  Operational feed  │
│  Diligence   │   Coach      │  Social      │  Admin queues      │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### 1.4 Intended Enterprise Positioning

CapitalOS aims to be an **institutional operating layer** for early-stage capital formation — combining:
- **Readiness intelligence** (scores, remediation, learning)
- **Controlled marketplace access** (approval gates, RLS, staff review)
- **Operational traceability** (events, notifications, compliance queue)
- **Workflow cohesion** (dashboard → queue → entity → action)

The codebase supports this vision structurally but has **gaps in end-to-end cohesion** (entity depth, event unification, permission granularity) typical of a fast-moving MVP scaling toward enterprise.

---

## 2. Route Inventory

**Totals:** ~46 page routes, ~78 API route handlers, 3 authenticated workspaces + public layer.

### 2.1 Admin Routes (`/admin/*`)

| Route | Group | Purpose | Primary users | Ops importance | Workflow stage |
|-------|-------|---------|---------------|----------------|----------------|
| `/admin`, `/admin/dashboard` | Dashboard | Command center KPIs, queues, activity, health | Admin, Analyst | Critical | Oversight |
| `/admin/companies` | Onboarding / Review | Company review pipeline, publish, remediation view | Admin, Analyst | Critical | Review → publish |
| `/admin/investors` | Onboarding / CRM | Investor approval queue, profiles, subscriptions | Admin, Analyst | Critical | Approval |
| `/admin/crm` | CRM | Cross-party activity, threads, outreach summary | Admin, Analyst | High | Relationship tracking |
| `/admin/spvs` | SPV | SPV command center — full lifecycle inline | Admin, Analyst | Critical | SPV ops |
| `/admin/compliance` | Compliance | Risk review queue, sections, high-risk companies | Admin, Analyst | Critical | Risk response |
| `/admin/queues` | Queues | Seven operational queues with drill-down links | Admin, Analyst | Critical | Triage |
| `/admin/reports` | Reports | Report generation and export | Admin, Analyst | High | Reporting |
| `/admin/imports` | Imports/exports | Import wizard, templates, export center | Admin, Analyst | High | Data ops |
| `/admin/billing` | Settings / Billing | Upgrade requests, subscription oversight | Admin, Analyst | Medium | Monetization |
| `/admin/analytics` | Analytics | Platform-wide breakdowns | Admin, Analyst | Medium | Insight |
| `/admin/system-health` | Dashboard | Env status, action health, recovery | Admin, Analyst | High | Reliability |
| `/admin/page-builder-lab` | Page builder | CMS lab (RBAC: `manage_page_builder`) | Super-admin staff | Low | Content |
| `/admin/users/permissions` | RBAC | Internal permission management | Super-admin staff | High | Security |
| `/admin/diligence` | Reports | Redirect → `/admin/reports` | Admin | Low | Legacy |

### 2.2 Founder Routes (`/founder/*`)

| Route | Group | Purpose | Primary users | Ops importance | Workflow stage |
|-------|-------|---------|---------------|----------------|----------------|
| `/founder`, `/founder/dashboard` | Dashboard | Onboarding, readiness, remediation, fit signals | Founder | Critical | Home |
| `/founder/onboarding` | Onboarding | Multi-step wizard | Founder | Critical | Setup |
| `/founder/readiness` | Readiness | Scores, checklist, remediation plan | Founder | Critical | Preparation |
| `/founder/documents` | Diligence | Data room uploads | Founder | Critical | Diligence |
| `/founder/investors` | CRM | Contacts, outreach, intro context | Founder | High | Engagement |
| `/founder/messages`, `/founder/messages/[threadId]` | Messaging | Inbox and thread workspace | Founder | High | Communication |
| `/founder/capital-raise` | SPV | Pledges, SPV status, company updates | Founder | High | Raise tracking |
| `/founder/learning`, `/founder/learning/[slug]/[lessonKey]` | Learning | Courses, lessons, AI assistant | Founder | Medium | Education |
| `/founder/analytics` | Analytics | Founder metrics | Founder | Medium | Insight |
| `/founder/settings` | Settings | Account, Google Calendar | Founder | Medium | Configuration |
| `/founder/report` | Reports | AI diligence report (feature-gated) | Founder | High | Diligence output |

### 2.3 Investor Routes (`/investor/*`)

| Route | Group | Purpose | Primary users | Ops importance | Workflow stage |
|-------|-------|---------|---------------|----------------|----------------|
| `/investor/dashboard` | Dashboard | Pipeline, interests, intros, matches | Investor | Critical | Home |
| `/investor/onboarding` | Onboarding | Profile wizard, submission | Investor | Critical | Setup |
| `/investor/opportunities` | Marketplace | AI-matched deals | Investor | High | Discovery |
| `/investor/opportunities/[companyId]/report` | Reports | Company diligence report | Investor | High | Evaluation |
| `/investor/watchlist` | CRM | Saved deals | Investor | Medium | Tracking |
| `/investor/interest-pipeline` | CRM | Interests and intro requests | Investor | High | Pipeline |
| `/investor/spvs` | SPV | Participations, document uploads | Investor | High | SPV participation |
| `/investor/portfolio` | CRM | Portfolio (approval-gated) | Investor | Medium | Holdings view |
| `/investor/messages`, `/investor/messages/[threadId]` | Messaging | Inbox and threads | Investor | High | Communication |
| `/investor/analytics` | Analytics | Investor metrics | Investor | Medium | Insight |
| `/founder/settings` | Settings | Account settings | Investor | Medium | Configuration |

### 2.4 API Routes (`/api/*`) — Grouped Summary

| Group | Count (approx.) | Purpose |
|-------|-----------------|---------|
| `/api/admin/*` | 34 | Staff mutations: companies, investors, SPV, compliance, imports, exports, reports, page builder, permissions |
| `/api/founder/*` | 20 | Onboarding, outreach, learning, remediation, company updates, social drafts |
| `/api/investor/*` | 8 | Onboarding, interests, intros, saved deals, pledge, SPV participations/uploads |
| `/api/messaging/*` | 3 | Thread messages, meetings |
| `/api/documents/*` | 2 | Upload, signed URLs |
| `/api/notifications/*` | 2 | List, mark read |
| `/api/integrations/google/*` | 3 | OAuth connect/callback/disconnect |
| `/api/companies/*`, `/api/onboarding`, `/api/billing`, `/api/ai`, `/api/auth` | 6+ | Cross-cutting |

**API organization:** Domain-first (`admin`, `founder`, `investor`) with nested resources. Each route self-authenticates; `/api/*` is **not** protected by edge proxy.

### 2.5 Public Routes

| Route | Group | Purpose |
|-------|-------|---------|
| `/` | Marketing | Homepage |
| `/deals`, `/deals/[slug]` | Marketplace | Public listings |
| `/founders`, `/investors` | Marketing | Persona landing pages |
| `/pricing`, `/submit-company` | Marketing / Intake | Pricing, company submission |
| `/login`, `/auth/sign-in`, `/auth/sign-up`, `/auth/reset-password` | Auth | Authentication |
| `/upgrade`, `/billing` | Billing | Upgrade flow, founder billing |
| `/notifications` | Notifications | Cross-role notification page |
| `/preview/[page]` | Page builder | Admin preview (permission-gated) |
| `/configuration-error` | Utility | Misconfiguration surface |

---

## 3. Database Architecture Audit

### 3.1 Scale & Structure

| Metric | Value |
|--------|-------|
| Migration files | 44 (`0001`–`0044`) |
| Tables | 52 |
| RLS-enabled tables | ~50 |
| Native PostgreSQL ENUM types | 0 (text + CHECK constraints) |
| Storage buckets | 4 (pitch-decks, company-documents, spv-investor-documents, learning-videos) |

### 3.2 Table Groups

| Domain | Tables | Role |
|--------|--------|------|
| Identity & access | `profiles`, `company_members`, `subscriptions`, `upgrade_requests`, `connected_accounts`, `internal_*` (5 RBAC tables) | Auth, entitlements, fine-grained admin permissions |
| Companies & marketplace | `companies`, `documents`, `diligence_reports`, `campaigns`, `admin_reviews`, `company_updates` | Founder entity, listings, diligence |
| Platform investor CRM | `investor_profiles`, `investor_interests`, `intro_requests`, `saved_deals`, `investor_activity`, `investor_pipeline`, messaging (3) | Investor actions and staff CRM |
| Founder private CRM | `founder_investor_contacts`, `founder_outreach_targets`, `outreach_campaigns`, `outreach_messages`, `social_outreach_drafts` | Founder-owned outreach |
| SPV workflow | `spv_opportunities`, `spv_participations`, `spv_participation_requirements`, `spv_checklist_items`, `spv_document_packages`, `spv_closing_reviews` | Operational SPV lifecycle |
| Compliance & operations | `compliance_events`, `operational_activity_events`, `audit_logs`, `import_batches`, `import_batch_rows` | Risk queue, universal feed, legacy audit, bulk ops |
| Learning & remediation | 8 tables | Courses, progress, video assets, remediation tasks |
| Platform misc | `notifications`, `page_builder_drafts`, `page_builder_snapshots` | Alerts, CMS lab |

### 3.3 Relationship Model (Simplified)

```
profiles ──< companies ──< documents / campaigns / spv_opportunities
    │              │
    │              └──< compliance_events, operational_activity_events
    ├──< investor_profiles
    ├──< investor_interests / intro_requests / saved_deals
    └──< spv_participations ──< spv_participation_requirements

spv_opportunities ──< checklist_items, document_packages, closing_reviews (1:1)
import_batches ──< import_batch_rows
```

**Hub tables:** `profiles`, `companies`, `spv_opportunities`  
**Bridge tables:** `spv_participations`, `investor_pipeline`, `company_members`

### 3.4 Audit & Event Systems

| System | Table | Mutability | Primary use |
|--------|-------|------------|-------------|
| Legacy audit | `audit_logs` | Append-oriented | General action log |
| Investor CRM log | `investor_activity` | Append-only | Per-investor×company timeline |
| Compliance queue | `compliance_events` | Staff workflow CRUD | Actionable review items |
| Universal ops feed | `operational_activity_events` | Append-only (service role writes) | Cross-domain admin timeline |
| Notifications | `notifications` | Server-created | User-facing alerts |

**Admin queues are virtual** — computed at read time in `src/lib/queues/admin-queues.ts`, not persisted.

### 3.5 Schema Strengths

1. **Coherent SPV subgraph** — normalized child tables with explicit lifecycle artifacts
2. **Thorough RLS** — security-definer helpers (`is_staff`, `user_belongs_to_company`, etc.)
3. **Import provenance** — batch rows link to created entities
4. **Indexed operational events** — category, entity, dedupe_key partial index
5. **Idempotent migrations** — safe re-application in dev/staging
6. **Intentional CRM separation** — platform CRM vs founder private CRM

### 3.6 Schema Concerns

| Concern | Severity | Detail |
|---------|----------|--------|
| Triple audit trail | Medium | `audit_logs`, `investor_activity`, `operational_activity_events` overlap |
| Compliance dual representation | Medium | Actionable `compliance_events` vs operational events with `event_category=compliance` |
| Company status proliferation | Medium | `status`, `review_status`, `is_published`, `marketplace_visible` coexist |
| Dual admin authorization | High | `profiles.role` vs `internal_*` RBAC; `is_staff()` ignores internal permissions |
| SPV denormalization drift | Medium | Counters/PCTs on `spv_opportunities` must sync via app logic |
| Text CHECK enums | Low–Medium | Flexible but migration-heavy (`investor_activity.activity_type` rewritten 4×) |
| Unprotected tables | Medium | `campaigns`, `diligence_reports` lack RLS (service-role-only today) |
| Hand-maintained types | Medium | `types.ts` Relationships empty; drift risk vs migrations |
| No durable job queue table | Medium | “Queued” outreach/import states are flags, not workers |

### 3.7 Missing Relationship Opportunities

- Unified **entity_timeline** view model (company/investor/spv) over fragmented event tables
- Explicit **workflow_instance** or **case** table linking review → remediation → publish → SPV
- **Queue item persistence** for SLA tracking, assignment, and audit
- Foreign key metadata in generated types for safer joins and documentation

---

## 4. Workflow Architecture Audit

### 4.1 Founder Lifecycle

```
Signup → ensureFounderCompany → Onboarding (5 steps) → Documents + AI report
  → Onboarding progress → Remediation sync → Readiness dashboard
  → Admin review → Publish → Investor CRM / Outreach → Capital raise / SPV view
```

| Stage | Strengths | Friction | Enterprise maturity |
|-------|-----------|----------|---------------------|
| Signup / profile | Auto company provisioning | Role accepted from client on create-profile | Low |
| Onboarding | Step model, progress %, completion events | Overlaps remediation messaging | Medium |
| Remediation | Rules engine, priority, feature links | Duplicated with onboarding “fix this” UX | Medium |
| Publishing | Admin gates, marketplace flags | Multiple status fields | Medium |
| Investor engagement | Rich CRM hub, outreach readiness gates | Outreach buried under Investors nav | Medium |
| SPV participation | Founder timeline on capital-raise | View-only; admin owns mutations | Medium |

### 4.2 Investor Lifecycle

```
Signup → Onboarding wizard → submitted → Admin approval → Marketplace / matching
  → Interests / intros / watchlist → Messaging → SPV participations → Document uploads
```

| Stage | Strengths | Friction | Enterprise maturity |
|-------|-----------|----------|---------------------|
| Onboarding | Clear approval_status machine | Limited paths while pending | Medium |
| Approvals | API gates on sensitive actions | Admin queue lacks investor ID in URL | Medium |
| Discovery | Public + personalized opportunities | Shallow company depth (report only) | Medium |
| CRM activity | Full API + pipeline stages | Dashboard stages don’t deep-link | Low–Medium |
| SPV participation | Dedicated workspace, upload flow | Depends on admin SPV setup quality | Medium–High |

### 4.3 Admin Lifecycle

```
Dashboard KPIs → Operations control → Queues → Filtered module pages → Inline actions
  → Compliance / reports / imports → System health monitoring
```

| Stage | Strengths | Friction | Enterprise maturity |
|-------|-----------|----------|---------------------|
| Review | Fat inline cards with rich context | No `/admin/companies/[id]` record pages | Medium |
| Compliance | Scanner + queue + PATCH workflow | Events fragmented across sections | Medium |
| Queues | Seven queues, href drill-downs | Virtual queues — no SLA/assignment | Medium–High |
| Reports / imports | Preview/confirm, templates, exports | Import failures need ops runbooks | Medium |
| Operational actions | Broad API surface | RBAC not per-module | Low–Medium |

### 4.4 SPV Lifecycle

```
Create opportunity → Seed checklist → Complete checklist → sync-readiness → status=open
  → Investor participations → Seed requirements → Upload/review → Document packages
  → Closing review → Operational close
```

| Stage | Strengths | Friction | Enterprise maturity |
|-------|-----------|----------|---------------------|
| Creation | Admin API + inline UI | Single-page cognitive overload (~1000 LOC component) | Medium |
| Readiness | Computed status machine, denormalized KPIs | Sync must be triggered; not automatic on load | Medium |
| Investor requirements | Status machine, storage isolation | Queue links to requirement ID but no highlight | Medium–High |
| Packages / closing | 1:1 closing review, criteria model | Complex interdependencies | High (domain) |
| Operational close | assertSpvCanClose guard | Legal disclaimer burden on UX copy | Medium |

### 4.5 Workflow Duplication Map

| Duplicated concept | Locations | Impact |
|--------------------|-----------|--------|
| Activity logging | `investor_activity`, `operational_activity_events`, `audit_logs` | Reporting confusion |
| Staff authorization | `requireRole`, `requireStaffApi`, `internal_*` RBAC | Permission gaps |
| Company “pending” semantics | `status`, `review_status`, query aliases | Filter/drill-down complexity |
| Readiness signals | Diligence score, onboarding %, remediation, checklist | Multiple “readiness” definitions |
| Event → user alert | Notifications vs operational events | Incomplete admin timeline |

---

## 5. Operational Activity + Queues Audit

### 5.1 Operational Activity Architecture

**Location:** `src/lib/operational-activity/`

| Component | Function |
|-----------|----------|
| `create-event.ts` / `emitOperationalEvent` | Append with 15-min dedupe window |
| `event-queries.ts` | Admin feed retrieval |
| `event-display.ts` | Labels, icons, href routing |
| `sanitize.ts` | Metadata hygiene |
| `types.ts` | Categories, visibility, severity, workflow metadata hooks |

**Instrumentation coverage (approximate):**
- Operational event emitters: **~12 call sites** (onboarding, CRM actions, imports, exports, reports, compliance, SPV sync)
- Notification emitters: **~80+ references** across SPV, messaging, outreach, remediation, billing, learning

**Gap:** Admin timeline is **thinner than notification domain** — many staff-relevant actions appear in bells but not operational feed.

### 5.2 Queue Architecture

Seven queue types in `src/lib/queues/admin-queues.ts`:

| Queue | Source data | Drill-down target |
|-------|-------------|-------------------|
| `company_reviews` | `companies.review_status` | `/admin/companies?status=pending_review&company={id}` |
| `investor_approvals` | `investor_profiles.approval_status=submitted` | `/admin/investors?status=submitted` |
| `compliance_escalations` | High/critical open events | `/admin/compliance?severity/event=...` |
| `spv_blockers` | SPV readiness gaps | `/admin/spvs?readiness/spv=...` |
| `investor_documents` | Pending requirement statuses | `/admin/spvs?queue=investor_documents&requirement={id}` |
| `founder_remediation` | Open remediation tasks | `/admin/companies?queue=remediation&company={id}` |
| `imports_exports` | Failed/partial import batches | `/admin/imports`, `/admin/reports` |

### 5.3 Dashboard → Queue → Entity → Action Model

```
/admin/dashboard
    ├── KPI cards ──────────► filtered list pages (companies, investors, compliance, SPVs)
    ├── Operations control ─► /admin/queues?queue=...
    │                              └── queue item href ─► filtered module + entity param
    ├── Activity timeline ──► operational_activity_events (with href)
    └── Platform graph ─────► CRM activity filters
```

**Strengths:**
- URL-driven drill-downs (shareable, back-button friendly)
- Query-param filtering recently wired on destination pages
- Queue summary integrated into dashboard operations control

**Weaknesses:**
- Entity params filter lists but **don’t auto-expand/focus** target cards
- Investor queue lacks entity-scoped URL
- No assignment, SLA, or “claimed by” semantics
- Queues rebuilt on each request — no historical queue metrics

### 5.4 Future Automation & AI Leverage (Operations)

| Opportunity | Enabler in code | Value |
|-------------|-----------------|-------|
| Queue prioritization | `OperationalWorkflowMetadata`, severity, readiness scores | Reduce analyst triage time |
| Bottleneck detection | SPV readiness machine, remediation counts, queue aggregation | Proactive escalation |
| Auto-routing | Event categories + entity IDs | Route compliance vs SPV vs review |
| SLA alerting | Queue timestamps (`formatQueueAge`) | Institutional ops discipline |
| Workflow playbooks | Drill-down hrefs as action templates | Consistent analyst behavior |

---

## 6. Dashboard + UX Audit

### 6.1 Admin Dashboard

**Implementation:** `AdminDashboardShell` at `/admin` and `/admin/dashboard`

| Element | Assessment |
|---------|------------|
| Command header | Quick links to key modules — good |
| KPI grid | Drill-down linked — good |
| Operations control | Queue summary cards — strong |
| Platform activity graph | Category drill-downs — good |
| Investor activity panels | CRM-linked — good |
| Recent activity timeline | Operational feed — improving |
| System health | Operational snapshot — good |

**Enterprise polish:** 7/10 — information-rich but dense; analyst onboarding would need runbooks.

### 6.2 Founder Dashboard

**Implementation:** `/founder/page.tsx`

- Onboarding progress, readiness, remediation preview, learning, investor fit, pledges
- Plan-gated features via `FounderFeatureGate`
- Multi-page workspace (not single dashboard for everything) — appropriate

**Friction:** Outreach discoverability; onboarding/remediation overlap.

### 6.3 Investor Dashboard

**Implementation:** `/investor/dashboard/page.tsx`

- Pipeline stages, saved deals, interests, intros, top matches
- Approval banner / gating
- Limited deep-links from pipeline widgets

### 6.4 UX Pattern Consistency

| Pattern | Admin | Founder | Investor |
|---------|-------|---------|----------|
| Workspace sidebar | ✓ layout | Per-page shell | ✓ layout |
| ViewToolbar (view/density/search) | Companies, SPVs | Limited | Limited |
| Query filter chips | CRM, companies, investors, SPVs, compliance | — | — |
| Drill-down linked cards | ✓ | Partial | Partial |
| Entity detail routes | ✗ (list-centric) | Threads only | Threads + report |
| Saved views | Placeholder | — | — |

### 6.5 UX Issues Inventory

| Issue | Severity | Notes |
|-------|----------|-------|
| No admin entity record pages | High | Bookmarking/sharing review context is hard |
| Inconsistent filtering across modules | Medium | Recently improved on admin destinations |
| Overloaded SPV admin page | High | Full lifecycle on one scroll |
| Weak empty states (some modules) | Low–Medium | Query-filter empty states added |
| Duplicate terminology | Low | Command center vs operations control |
| Notification bell deep links | Medium | May not match queue href precision |
| Saved views disabled | Medium | Power users cannot persist filters |

---

## 7. Entity-Depth Audit

### 7.1 Assessment Matrix

| Entity | Admin | Founder | Investor | Verdict |
|--------|-------|---------|----------|---------|
| **Company** | Fat inline card (`AdminCompanyCard`, ~644 LOC) | Multi-page workspace | Report subroute only | Admin: **inline workspace**; Investor: **shallow** |
| **Investor** | Review cards + directory | N/A (contacts are separate) | Profile/onboarding | Admin: **shallow list** |
| **SPV** | Inline full lifecycle editor | Status panel on capital-raise | `InvestorSpvWorkspace` | Admin: **deep function, shallow IA**; Investor: **focused workspace** |

### 7.2 Missing Operational Context

| Gap | Impact |
|-----|--------|
| Unified entity timeline (company/investor/SPV) | Analysts reconstruct story from multiple modules |
| Relationship graph (who engaged whom, when) | CRM intelligence limited to lists |
| Cross-links from compliance event → exact company card state | Extra navigation |
| SPV requirement → jump to investor profile | Manual correlation |
| Founder view of investor approval status on CRM | Asymmetric visibility |

### 7.3 Target State (Documentation Only)

Enterprise record pages would provide:
- **Header:** status chips, assignment, SLA, primary actions
- **Timeline:** operational events + notifications + CRM activity
- **Related entities:** SPVs, compliance events, remediation tasks
- **Workflow panel:** queue context, next recommended action

Current state is approximately **60% functional depth, 30% information architecture depth** for admin entities.

---

## 8. Notification + Event Architecture Audit

### 8.1 Systems Comparison

| Capability | Notifications | Operational events | Compliance events | audit_logs |
|------------|---------------|--------------------|--------------------|------------|
| User-facing | ✓ | ✗ (admin feed) | ✗ (staff queue) | ✗ |
| Actionable workflow | Read/mark read | View only | PATCH resolve/dismiss | None |
| Dedupe | `notifyStaffIfNotRecent` | 15-min dedupe key | App dedupe in recordComplianceEvent | None |
| Entity linking | Partial | Strong metadata | company/investor IDs | entity_type/id |
| Category taxonomy | 60+ types | 13 categories | severity + event_type | action string |
| Write volume | High | Low–medium | Medium | Legacy/low |

### 8.2 Fragmentation Risk

```
                    ┌─────────────────┐
  User actions ────►│  Notifications  │───► Bell / email (future)
                    └─────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  investor_activity   compliance_events   audit_logs
         │                 │                 │
         └────────► operational_activity_events ◄── (intended unifier)
```

**Automation readiness:** Medium — rich notification types but **no orchestration engine** (no job queue, no workflow engine, no external webhook layer).

**Recommendation direction:** Operational events as **canonical audit bus**; notifications as **delivery channel**; compliance events as **actionable subset**; deprecate `audit_logs` writes over time.

---

## 9. RBAC + Security Audit

### 9.1 Authorization Layers

| Layer | Mechanism | Coverage |
|-------|-----------|----------|
| Edge | `proxy.ts` — session + role for `/admin`, `/founder`, `/investor` | Workspace paths only |
| Page | `requireRole`, `requireInvestorWorkspaceSession`, `requirePermissionPage` | Most pages |
| API | `requireStaffApi`, `requireInvestorApi`, ad-hoc checks | Per-route |
| Database | RLS on ~50 tables | User-scoped client only |
| Internal RBAC | `internal_*` tables, 11 permissions | Page builder + user permissions only |

### 9.2 Strengths

- Investor sensitive actions gated on `approval_status`
- RLS helper functions reduce policy duplication
- SPV document storage isolated by bucket and document type
- Internal RBAC schema exists for future granular control
- Compliance and operational events staff-only by design

### 9.3 Privilege Risks

| Risk | Severity | Detail |
|------|----------|--------|
| Client-supplied role on create-profile | **High** | Body.role accepted without allowlist |
| Legacy staff permissions grant broad access | **High** | All permissions except manage_users/page_builder |
| Service role bypasses RLS | **High** | Default for admin API via `requireStaffApi` |
| RBAC not enforced on admin modules | **Medium** | Nav hides items; routes do not check permissions |
| `/api/*` not edge-protected | **Medium** | 78 routes must each authenticate correctly |
| `campaigns`, `diligence_reports` without RLS | **Medium** | Safe only if never queried with user client |
| Public marketplace via service role | **Medium** | Filter bugs could leak unpublished companies |

### 9.4 Security Risk Matrix

| Risk | Likelihood | Impact | Priority |
|------|------------|--------|----------|
| Role escalation at signup | Medium | Critical | P0 |
| Analyst over-permission via legacy RBAC | High | High | P0 |
| Cross-tenant data via service role bug | Low | Critical | P0 |
| Missing RLS on legacy tables | Low | High | P1 |
| Inconsistent API auth patterns | Medium | Medium | P1 |

---

## 10. Technical Debt Audit

### 10.1 Oversized Components (>300 LOC)

| Lines | File | Risk |
|------:|------|------|
| 1233 | `PageBuilderLab.tsx` | High — untestable UI monolith |
| 1019 | `AdminSpvManagement.tsx` | High — core ops surface |
| 783 | `FounderInvestorHubPanels.tsx` | Medium |
| 644 | `AdminCompanyCard.tsx` | Medium |
| 574 | `AdminReportsPanel.tsx` | Medium |
| 549 | `AdminImportExportCenter.tsx` | Medium |

### 10.2 Duplicated Patterns

| Pattern | Examples | Risk |
|---------|----------|------|
| Auth helpers (6+ variants) | `requireRole`, `requireStaffApi`, `requirePermissionApi`, … | Medium |
| Data loaders (`load-*.ts`) | 12 dedicated loaders | Low–Medium |
| Profile fetch chains | auth.ts, permissions.ts, proxy.ts | Low |
| Service role in pages | Most admin pages | Medium |
| Event emission | notifications vs operational vs audit | Medium |

### 10.3 Server/Client Boundary

- **62** page routes; **1** client page (`auth/reset-password`)
- **~70+** client components — appropriate island pattern
- Admin/investor use client **layouts** for shell only
- Founder uses per-page `FounderAppShell` (inconsistent with admin/investor)

### 10.4 Migration Complexity

- 44 migrations, additive style — **maintainable**
- Repeated CHECK constraint rewrites — **medium friction**
- Hand-maintained `types.ts` — **drift risk**

### 10.5 Technical Debt Summary by Severity

| Severity | Items |
|----------|-------|
| **High** | AdminSpvManagement monolith; dual auth models; service-role-by-default; create-profile role acceptance; triple audit system |
| **Medium** | Founder shell inconsistency; oversized AdminCompanyCard; virtual queues without persistence; API auth inconsistency; types drift |
| **Low** | Saved views placeholder; repeated profile fetches; misnamed initial migration; no TODO markers in code |

---

## 11. AI Opportunity Audit

### 11.1 Existing AI Hooks

| Area | Implementation |
|------|----------------|
| Diligence reports | `/api/ai/reports`, OpenAI |
| Learning | Class assistant, video script generation |
| Founder coach | `FloatingFounderAICoach` |
| Outreach | Social draft generation, templates |
| Matching | `getInvestorMatchingSummaries`, recommendations |
| Readiness | AI report feeds remediation rules |

### 11.2 Near-Term AI (Realistic, 3–6 months)

| Opportunity | Inputs available | Output |
|-------------|------------------|--------|
| **Queue prioritization** | Queue items, readiness scores, severity, age | Ranked analyst worklist |
| **Remediation recommendations** | Diligence report, remediation tasks, onboarding gaps | Next-best actions with links |
| **Compliance triage summaries** | `compliance_events`, company profile | One-paragraph analyst brief |
| **Investor-company match explanations** | Matching summaries, sector/stage prefs | “Why this match” copy |
| **Admin ops digest** | Operational feed + queue snapshot | Daily command center summary |
| **Import anomaly detection** | `import_batch_rows` validation errors | Suggested column fixes |
| **Founder guidance** | Onboarding step, remediation, learning progress | Contextual coach prompts |

### 11.3 Long-Term AI Moat (12+ months)

| Opportunity | Moat potential |
|-------------|----------------|
| **Institutional readiness scoring model** | Proprietary labeled outcomes from reviews + publishes |
| **Bottleneck forecasting** | Time-series on SPV readiness transitions |
| **Relationship intelligence graph** | Cross-company investor behavior patterns |
| **Automated workflow orchestration** | Policy-driven actions from operational events |
| **Predictive compliance** | Outreach/messaging risk before flagging |
| **Capital formation copilot** | End-to-end founder raise playbook |
| **Marketplace liquidity intelligence** | Interest/conversion analytics across deals |

### 11.4 AI Readiness Assessment

| Prerequisite | Status |
|--------------|--------|
| Structured domain data | Strong |
| Event instrumentation | Partial |
| Labeled workflow outcomes | Medium (review statuses, SPV states) |
| Unified feature store | Weak |
| Permission-safe AI endpoints | Medium |
| Human-in-the-loop UI | Strong (admin review patterns) |

---

## 12. Scalability Audit

### 12.1 Dimension Assessment

| Dimension | Current capacity | Bottleneck trigger |
|-----------|------------------|-------------------|
| **Operational** | Single admin team, virtual queues | >500 pending reviews; no assignment sharding |
| **Engineering** | Modular `src/lib` domains | Monolith components; dual auth; service role pattern |
| **UX** | Query-param drill-downs | No entity pages; SPV page overload |
| **Data** | 52 tables, indexed events | Operational event table growth; queue O(n) scans |
| **Workflow** | State machines in app code | Outreach/import “queued” without workers |

### 12.2 Likely Future Bottlenecks

1. **Admin SPV page** — linear complexity with SPV count
2. **Queue aggregation** — live queries across 7 domains per dashboard load
3. **Operational activity table** — append-only growth without archival strategy
4. **Notification fan-out** — staff notifications on high-volume events
5. **Service role data loads** — admin pages fetch broad datasets synchronously
6. **Hand-maintained types** — migration velocity slowdown

### 12.3 Scalability Recommendations (Documentation Only)

- Materialized queue snapshots or cached counts for dashboard
- Entity record routes with paginated timelines
- Background job processor for outreach/import queues
- Operational event archival (cold storage / aggregation)
- Generated Supabase types from schema

---

## 13. Enterprise Readiness Scoring

Scores are **1–10** (10 = enterprise-grade today).

| Dimension | Score | Rationale |
|-----------|------:|-----------|
| **Architecture** | 7.0 | Strong domain modules; overlapping event/auth systems |
| **Workflows** | 7.5 | End-to-end lifecycles exist; friction at entity depth |
| **UX** | 6.5 | Admin command center good; inconsistent depth and IA |
| **Scalability** | 6.0 | Works for pilot scale; queue and SPV UX won't scale linearly |
| **Operational maturity** | 7.5 | Queues, drill-downs, imports, compliance — recent strong investment |
| **AI readiness** | 6.5 | Data-rich; instrumentation and feature store immature |
| **Analytics maturity** | 6.0 | Workspace analytics exist; no unified metrics layer |
| **Security** | 5.5 | RLS strong for users; service-role + RBAC gaps |
| **Maintainability** | 6.5 | Good lib structure; large components and type drift |
| **Enterprise readiness (composite)** | **6.6** | **Early enterprise pilot — not production-institutional at scale** |

### 13.1 Current Stage Assessment

**Stage:** Growth MVP with **institutional ops scaffolding**  
Suitable for: controlled beta, single-team operations, limited tenant volume  
Not yet suitable for: multi-team RBAC at scale, unattended automation, regulatory audit without runbooks

### 13.2 Biggest Strengths

1. SPV operational domain model (checklist → closing)
2. Admin queue + drill-down operational model
3. RLS-first data design for user-scoped access
4. Compliance + outreach risk scanning
5. Import/export center with validation pipeline
6. Multi-workspace product completeness (founder + investor + admin)

### 13.3 Biggest Risks

1. Authorization gaps (create-profile role, legacy RBAC breadth, service role)
2. Fragmented audit/event/notification systems
3. Admin entity UX — list-centric, no record pages
4. Operational event under-instrumentation vs notifications
5. SPV admin surface complexity (human error risk)

### 13.4 Next Strategic Priorities

1. **Security hardening** — role allowlist, per-module RBAC enforcement
2. **Event unification** — operational events as canonical bus
3. **Entity record pages** — company, investor, SPV admin workspaces
4. **Queue persistence** — assignment, SLA, metrics
5. **Instrumentation parity** — emit operational events for all notification-worthy actions

---

## 14. Recommended Roadmap

### Tier 1 — Critical Stabilization & Cohesion (0–3 months)

| Priority | Initiative | Outcome |
|----------|------------|---------|
| P0 | Allowlist roles on create-profile / onboarding | Close privilege escalation |
| P0 | Enforce internal RBAC on admin modules + APIs | Least-privilege analysts |
| P0 | Audit service-role call sites; use user client + RLS where feasible | Reduce blast radius |
| P1 | Unify event writes — operational events primary, deprecate audit_logs | Single admin timeline |
| P1 | Admin entity record routes (`/admin/companies/[id]`, etc.) | Shareable ops context |
| P1 | Queue item deep links with focus/highlight (investor ID, SPV expand) | Faster triage |
| P1 | RLS on `campaigns`, `diligence_reports` | Close data exposure path |
| P2 | Split `AdminSpvManagement` into sub-modules | Maintainability |
| P2 | Generate Supabase types from schema | Type drift prevention |

### Tier 2 — Enterprise Operational Maturity (3–9 months)

| Priority | Initiative | Outcome |
|----------|------------|---------|
| P1 | Persisted queue items (assignment, status, SLA) | Institutional ops |
| P1 | Unified entity timeline component | Cross-module visibility |
| P1 | Saved views + analyst presets | Power-user efficiency |
| P2 | Background job processor (outreach, imports) | Reliable async workflows |
| P2 | Operational metrics dashboard (time-to-review, time-to-close) | KPI accountability |
| P2 | Notification → canonical href router | Consistent deep linking |
| P2 | Founder/investor drill-down parity | Cross-workspace cohesion |
| P3 | Audit export package for compliance reviews | Enterprise sales enablement |

### Tier 3 — Advanced Intelligence + AI Moat (9–18 months)

| Priority | Initiative | Outcome |
|----------|------------|---------|
| P1 | Queue prioritization ML/heuristics | Analyst efficiency moat |
| P1 | Readiness scoring v2 (outcome-labeled) | Proprietary intelligence |
| P2 | Relationship graph + investor intelligence | Network effects |
| P2 | Predictive compliance (pre-flag) | Risk reduction |
| P2 | Automated workflow playbooks from operational events | Orchestration |
| P3 | Institutional ops copilot (NL command center) | Category-defining UX |
| P3 | Marketplace liquidity forecasting | Platform moat |

### 14.1 Priority Matrix (Impact × Effort)

```
Impact ▲
  High │  RBAC enforce ●     Entity pages ●        AI queue rank ●
       │  Role allowlist ●   Event unify ●
       │  Service role audit ●
  Med  │  RLS gaps ●         Queue persist ●       Saved views ●
       │  Split SPV UI ●     Job processor ●
  Low  │  Typegen ●          Terminology cleanup ○
       └──────────────────────────────────────────────► Effort
            Low              Medium              High
```

### 14.2 Risk Matrix (Platform)

| Risk area | Current | Post Tier 1 target |
|-----------|---------|-------------------|
| Authorization | 🔴 High | 🟡 Medium |
| Data exposure | 🟡 Medium | 🟢 Low |
| Ops error rate | 🟡 Medium | 🟢 Low |
| Audit completeness | 🟡 Medium | 🟢 Low |
| Scale ceiling | 🟡 Medium | 🟡 Medium |

---

## 15. Appendix

### 15.1 Key Technology Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind 4 |
| Backend | Supabase Auth + Postgres + Storage |
| Validation | Zod 4 |
| AI | OpenAI |
| Documents | PDFKit, XLSX |
| DnD | @dnd-kit |

### 15.2 Key File Index

| Domain | Path |
|--------|------|
| Workspace nav | `src/lib/workspace-nav.ts` |
| Auth | `src/lib/supabase/auth.ts` |
| RBAC | `src/lib/rbac/` |
| Queues | `src/lib/queues/admin-queues.ts` |
| Drill-downs | `src/lib/ui/drilldown-links.ts` |
| Query filters | `src/lib/ui/query-filters.ts` |
| Operational activity | `src/lib/operational-activity/` |
| SPV | `src/lib/spv/` |
| Compliance | `src/lib/compliance/` |
| Imports | `src/lib/imports/` |
| Notifications | `src/lib/notifications/` |
| Migrations | `supabase/migrations/` |
| Types | `src/lib/supabase/types.ts` |

### 15.3 Workflow Diagram — Platform Lifecycles

```
FOUNDER                          INVESTOR                         ADMIN
───────                          ────────                         ─────
Signup                           Signup                           Dashboard
  │                                │                                │
Onboarding                       Onboarding                       Queues
  │                                │                                │
Documents/AI                     submitted ───────────────────► Approval
  │                                │                                │
Remediation                      approved                         Company review
  │                                │                                │
Readiness ◄─────────────────────────────────────────────────── Publish
  │                                │                                │
Outreach/CRM                     Discovery                        CRM monitor
  │                                │                                │
Capital raise/SPV view           Interests/intros                 SPV ops
  │                                │                                │
                                 SPV participations ◄────────── Requirements
  │                                │                                │
                                 Upload docs                      Closing review
                                                                   Compliance
```

---

## Final Report

### 1. Files analyzed

Representative paths across the codebase:

- **App routes:** `src/app/admin/**`, `src/app/founder/**`, `src/app/investor/**`, `src/app/api/**`, public pages
- **Components:** `src/components/**`, `src/components/admin/**`, `src/components/ui/**`
- **Libraries:** `src/lib/**` (50+ domain modules)
- **Database:** `supabase/migrations/*.sql` (44 files), `src/lib/supabase/types.ts`
- **Config / routing:** `src/proxy.ts`, `src/lib/workspace-nav.ts`, `package.json`
- **Existing docs:** `docs/supabase-setup.md`, `docs/environments.md`, `docs/deployment-checklist.md`

### 2. Major systems identified

Identity & RBAC · Companies & marketplace · Platform investor CRM · Founder private CRM · Messaging · SPV operations · Compliance · Operational activity · Admin queues · Notifications · Imports/exports · Reports · Learning & remediation · Billing/subscriptions · Analytics · Page builder · Integrations (Google Calendar)

### 3. Workflow areas mapped

Founder lifecycle (7 stages) · Investor lifecycle (6 stages) · Admin lifecycle (5 stages) · SPV lifecycle (6 stages) · Dashboard→queue→entity→action model · Event/notification architecture

### 4. Technical debt summary

**High:** Monolithic admin SPV UI, dual auth models, service-role-by-default, triple audit trail, create-profile role risk  
**Medium:** API auth inconsistency, virtual queues, types drift, founder shell pattern, oversized company card  
**Low:** Saved views placeholder, terminology duplication, missing code TODO markers

### 5. Enterprise readiness summary

**Composite score: 6.6 / 10** — strong domain foundation and recent ops investments; needs security hardening, event unification, and entity-depth UX before institutional scale.

### 6. AI opportunity summary

**Near-term:** queue prioritization, remediation guidance, compliance briefs, match explanations, ops digests  
**Long-term:** readiness scoring moat, relationship graph, predictive compliance, workflow orchestration, capital formation copilot

### 7. Roadmap summary

- **Tier 1 (0–3 mo):** Security, RBAC, event unification, entity record pages, deep-link polish  
- **Tier 2 (3–9 mo):** Persisted queues, timelines, saved views, job processor, ops metrics  
- **Tier 3 (9–18 mo):** AI prioritization, proprietary scoring, relationship intelligence, orchestration

### 8. Confirmation

**No production logic was modified** to produce this audit. Only `docs/architecture-audit.md` was created.

---

*End of CapitalOS Enterprise Architecture Audit*
