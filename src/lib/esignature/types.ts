// Shared types + constants for the e-signature feature (single-signer build).
// Tables are not in the generated Supabase types yet, so these mirror the
// migration (20260621003_esignature.sql).

export type SignatureStatus = "draft" | "sent" | "viewed" | "signed" | "completed" | "voided";
export type SourceFormat = "pdf" | "docx";
export type FieldType = "signature" | "date" | "company" | "text" | "initial";
export type AutoSource = "signing_date" | "signer_company";
export type AuditEventType =
  | "created"
  | "sent"
  | "opened"
  | "consented"
  | "signed"
  | "sealed"
  | "voided";

export type SignatureRequest = {
  id: string;
  document_name: string;
  deal_label: string | null;
  source_format: SourceFormat;
  source_file_path: string | null;
  working_file_path: string;
  signed_file_path: string | null;
  page_count: number;
  signer_name: string | null;
  signer_email: string | null;
  signer_company: string | null;
  status: SignatureStatus;
  access_token: string | null;
  consent_accepted: boolean;
  document_hash: string | null;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  voided_at: string | null;
};

export type SignatureField = {
  id: string;
  request_id: string;
  field_type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  auto_source: AutoSource | null;
  placeholder: string | null;
  value: string | null;
  created_at: string;
};

// ── Upload limits (configurable) ────────────────────────────────────────────
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PAGE_COUNT = 50;

export const MIME_PDF = "application/pdf";
export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPTED_MIME_TYPES = new Set<string>([MIME_PDF, MIME_DOCX]);

// ── Storage folders within the private `signature-documents` bucket ─────────
export const STORAGE_BUCKET = "signature-documents";
export const STORAGE_FOLDER_SOURCE = "source"; // original .docx
export const STORAGE_FOLDER_ORIGINALS = "originals"; // working PDF
export const STORAGE_FOLDER_SIGNED = "signed"; // sealed PDF

// ── Branding & display strings (do not invent alternates) ───────────────────
export const BRAND = {
  /** UI wordmark — admin shell + signer page header. */
  productName: "iCFO Capital Global, Inc.",
  /** Email "from" / sender name on signing invites + completion notices. */
  emailSender: "iCFO Venture Group",
  /** Sealed-document footer / stamp. */
  sealStamp: "Signed via iCFO Capital Global, Inc.",
  /** Optional tagline / positioning line. */
  tagline: "The Capital Readiness Platform",
} as const;
