# E-signature

In-platform e-signing for iCFO Capital Global, Inc. An admin uploads a deal
document, places fields, and sends it to one signer via a secure email link. The
signer consents, completes the fields, and signs. The system seals the PDF,
records a legally-defensible audit trail, and stores the result.

Single-signer for this build; the schema separates fields from the envelope so
multi-signer routing can be added later without a rewrite.

## Branding

- Product wordmark (UI): **iCFO Capital Global, Inc.**
- Email sender name: **iCFO Venture Group**
- Sealed-PDF footer stamp: **Signed via iCFO Capital Global, Inc.**

Constants live in `types.ts` (`BRAND`).

## Data model (`supabase/migrations/20260621003_esignature.sql`)

- `signature_requests` — the envelope (document, signer, status, access token, hash).
- `signature_fields` — placed fields with normalized 0–1 coordinates (resolution-independent).
- `signature_audit_events` — the tamper-evidence chain.
- Private storage bucket `signature-documents` with folders `source/` (original .docx),
  `originals/` (working PDF), `signed/` (sealed PDF).

RLS: owning staff (`is_staff()` AND `created_by = auth.uid()`) read/write their own
envelopes and fields, read their audit events. The token-gated signer flow runs
server-side with the service-role client, which bypasses RLS — anonymous clients
never touch the tables or bucket directly.

## Flow & status machine

`draft → sent → viewed → signed → completed`, plus `voided` from any pre-signed state.

1. **Upload** (`POST /api/admin/signatures/upload`) — validates a PDF (25 MB / 50-page
   limits), stores the working PDF, creates a draft, writes the `created` event.
   DOCX→PDF is wired behind `convertDocxToPdf()` (CloudConvert) but disabled — PDF-only.
2. **Place fields** (`/admin/signatures/[id]`, `PUT …/fields`) — signature, date,
   company, text (initial is schema-only). Coordinates are normalized.
3. **Send** (`/admin/signatures/[id]/send`, `POST …/send`) — saves signer details,
   generates a 32-byte hex `access_token`, flips to `sent`, writes `sent`, emails the
   signer `/sign/{token}` via Resend.
4. **Sign** (`/sign/{token}`) — token-gated, unauthenticated. Records `opened`,
   ESIGN/UETA consent gate (`consented`), company fields auto-fill read-only, signature
   captured by draw or type. On finish: values saved, `signed` written.
5. **Seal** (`seal.ts`, invoked from the submit route) — burns values + signature image
   into the PDF, SHA-256 hashes it, stores `signed/{id}.pdf`, sets `completed`, writes
   `sealed`, emails both parties the sealed-copy link.
6. **Void** (`POST …/void`) — voids an unsigned envelope, writes `voided`.

## Pure helpers (unit-tested — `compute.test.ts`)

- `fieldToPdfRect()` — normalized top-left box → pdf-lib bottom-left points (Y flip).
- `resolveAutoValue()` — server-authoritative date/company auto-fill resolution.

## Configuration

- `RESEND_API_KEY` (+ `EMAIL_FROM`) — invites & completion notices. Without it the
  feature still works; you copy the signing link from the send screen manually.
- `CLOUDCONVERT_API_KEY` — only needed to re-enable .docx conversion (currently off).

## Dependencies

- `pdf-lib` — seal/burn + page counting (server).
- `pdfjs-dist` — client PDF rendering for placement + signing. Worker loads from
  cdnjs pinned to the installed version; verify it isn't CSP-blocked in your deploy.

## Permissions

Admin surfaces are gated by the `review_documents` RBAC permission.
