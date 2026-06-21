# Due Diligence module

Admin (iCFO) runs a full diligence engagement end to end; the founder responds
and signs; investors read a released cut. Evidence-driven (claims tracked
claimed→verified), every layer role-gated, consent/versions immutable + audited.

## Lifecycle

```
draft → sent_to_founder → responding → admin_review →
consent_requested → consented_locked → released
```

`recall` (admin) steps one stage back (pre-lock). Transition rules live in
`state-machine.ts` (pure, unit-tested).

## Roles & access

`profiles.role` + `dd_engagement_members(engagement_id, user_id, role)`. Staff
(`public.is_staff()`) have global admin access; founders/investors are scoped to
a single engagement by membership. RLS is the enforcement layer; the visibility
gate + `serializeReport()` are the field/section filter on top.

## Visibility gate (§10)

`dd_visibility_gate` has a row per section (`findings`, `responses`, `data_room`,
`candor`, `icfo_review`, `verdict`) × `founder_visible` / `investor_visible`.
Defaults applied on send-to-founder (`gate.ts` `DEFAULT_GATE`). The gate is set
deliberately in the send step (UI toggles), never silently. `applyRoleFilter()`
(in `serialize.ts`, unit-tested) drops claims for non-admins, strips
`internal_note` (candor) and `icfo_review`, and shows the verdict only when gated.

## Confidence (§11)

Severity-weighted: claims linked to a high-severity finding count double.
`confidence.ts` (`computeConfidencePure`, unit-tested). Recomputed whenever a
claim or doc-request is verified.

## Data flow

1. **Create** — `createEngagement` seeds 5 fixed domains + the gate (`dd_seed_engagement`).
2. **AI draft** (`generate.ts`) — Claude drafts domains/findings/claims for admin edit; never auto-published.
3. **Register + ledger** (`data.ts`) — admin CRUD on findings/claims; `verifyClaim` advances the finding + recomputes confidence.
4. **Send to founder** (`admin-actions.ts`) — adds the founder member, applies the default gate, transitions, notifies.
5. **Founder loop** (`founder.ts`, `founder-actions.ts`) — gated read via the founder's RLS session; responses + uploads via service role after `assertFounderMember`. Uploads advance findings; first response → `responding`.
6. **Data room** (`dataroom.ts`) — auto-generate requests from open findings; admin verify advances findings + their claims → confidence.
7. **PDF** (`pdf.ts`) — pdfkit memo from `serializeReport(role)`; admin-full or gated cut.
8. **Consent** (`consent.ts`) — freezes a `dd_report_versions` snapshot, renders the PDF, opens an in-house e-signature envelope for the founder. The e-sign submit route calls `onSignatureCompleted()`, which seals the version (SHA-256 + cert path) and transitions to `consented_locked`.
9. **Release** — `lockAndRelease` requires a sealed version, transitions to `released`, notifies investors.
10. **Investor cut** (`investor.ts`) — released, gated package at `/investor/deals/[id]`.

## Audit

Every mutation writes to `dd_audit_log` (append-only — `update`/`delete` revoked).
Surfaced in the admin workspace Activity tab via `listDdAudit`.

## Storage

Private buckets `dd-documents` (founder uploads) and `dd-reports`. The sealed
consent PDF lives in the e-signature bucket (`signed/`). All served via
short-lived signed URLs.

## Config

- `ANTHROPIC_API_KEY` — AI drafting (degrades to manual without it).
- `RESEND_API_KEY` (+ `EMAIL_FROM`) — notifications (§16).
- Consent reuses the in-house e-signature module — no external eSign provider.

## Permissions

Admin surfaces gated by the `manage_diligence` RBAC permission.

## Tests

`diligence.test.ts` (confidence, state machine, finding codes) and
`serialize.test.ts` (gate-stripping). Run `npm test src/lib/diligence`.
