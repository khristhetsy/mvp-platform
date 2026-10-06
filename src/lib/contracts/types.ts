// SPV contract send: shared types. Tables are not in the generated Supabase
// types yet, so these mirror supabase/migrations/20261002210000_spv_contracts.sql.

export type TemplateKind = "term_sheet" | "services_agreement" | "advisory_agreement" | "nda";
export type TemplateSubtype = "convertible_note" | "safe" | "series_a" | null;
export type FieldType = "text" | "date" | "currency" | "percent" | "multiline";

/** Contract types an uploaded contract is filed under (selection row on Contracts › Uploaded). */
export const CONTRACT_TYPES = [
  { key: "due_diligence_services", label: "Due Diligence Services" },
  { key: "safe", label: "SAFE" },
  { key: "convertible_note", label: "Convertible Note" },
  { key: "series_a", label: "Series A" },
  { key: "stock_and_cash", label: "Stock and Cash" },
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number]["key"];
export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = Object.fromEntries(CONTRACT_TYPES.map((t) => [t.key, t.label])) as Record<ContractType, string>;
export const isContractType = (v: unknown): v is ContractType => CONTRACT_TYPES.some((t) => t.key === v);

/**
 * Where a field lives in the master. `find` is located in a paragraph's text
 * (across Word runs); `replace` is the part of `find` that the token stands for
 * (defaults to all of `find`). `context` limits the match to paragraphs whose
 * text contains it. `nth` picks one occurrence (0 based, document order) instead
 * of all of them.
 */
export type FieldMatch = { find: string; replace?: string; context?: string; nth?: number };

export type TemplateField = {
  token: string;
  label: string;
  type: FieldType;
  required: boolean;
  default_value: string | null;
  position_ref: FieldMatch[];
  sort_order: number;
};

export type ContractTemplate = {
  id: string;
  key: string;
  name: string;
  kind: TemplateKind;
  subtype: TemplateSubtype;
  version: number;
  status: "active" | "retired";
  /** Which entity signs for iCFO by default (master's own party). */
  default_entity_id: string | null;
  /** Literal entity name in the master that the issuing entity token replaces. */
  entity_match: string | null;
  /** Signature anchors used to place fields on the rendered PDF. */
  signature_anchors: SignatureAnchors;
  has_expiry: boolean;
  created_by: string | null;
  created_at: string;
};

/**
 * Text anchors in the rendered PDF. `prospect` is the company's block; each
 * `countersign` entry is a block iCFO signs. `party` is a token or a literal:
 * "{{company_name}}" resolves to the filled value. The block is the nearest
 * "By:" below the party line, then Name:, Title:, Date: under it.
 */
export type SignatureAnchors = {
  prospect: { party: string };
  countersign: { party: string }[];
};

export type IssuingEntity = {
  id: string;
  legal_name: string;
  short_name: string;
  address: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  active: boolean;
};

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "changes_requested"
  | "awaiting_countersign"
  | "signed"
  | "declined"
  | "cancelled"
  | "expired"
  /** Sent for review only: PDFs emailed, no signature requested. */
  | "shared";

export type Segment = { text: string; b?: boolean; i?: boolean };
/** Paragraph id → new segments, or null to delete the paragraph. */
export type ParagraphEdits = Record<string, Segment[] | null>;
export type InsertedParagraph = { id: string; after: string; segments: Segment[] };
export type BodyEdits = { edits: ParagraphEdits; inserted: InsertedParagraph[] };

export const EMPTY_EDITS: BodyEdits = { edits: {}, inserted: [] };

export type ContractDocument = {
  id: string;
  document_key: string;
  /** Null only for an uploaded draft whose recipient is not chosen yet. */
  contact_id: string | null;
  /** Uploaded contracts: the type chosen at upload. */
  contract_type: ContractType | null;
  /** Template documents only; uploaded contracts have none. */
  template_id: string | null;
  template_version: number | null;
  /** "upload" = a finished PDF uploaded by staff (no fields, no editor). */
  source: "template" | "upload";
  /** Uploaded contracts: the name shown everywhere instead of a template name. */
  title: string | null;
  /** Uploaded contracts: the original PDF in the contract-documents bucket. */
  upload_path: string | null;
  entity_id: string | null;
  version: number;
  field_values: Record<string, string>;
  body_edits: BodyEdits;
  status: ContractStatus;
  locked: boolean;
  docx_path: string | null;
  pdf_path: string | null;
  page_count: number | null;
  signature_request_id: string | null;
  packet_id: string | null;
  countersign_fields: CountersignField[] | null;
  executed_path: string | null;
  certificate_path: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  /** Opens of the packet page, for documents sent for review only (signing envelopes count their own). */
  open_count?: number;
  last_opened_at?: string | null;
  archived_at: string | null;
};

/** A box on the rendered PDF, normalized 0..1 from the top left (same as signature_fields). */
export type PlacedBox = { page: number; x: number; y: number; width: number; height: number };
export type CountersignField = PlacedBox & { kind: "signature" | "name" | "title" | "date" };

export const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  changes_requested: "Changes requested",
  awaiting_countersign: "Awaiting countersign",
  signed: "Signed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  shared: "Sent, no signature",
};

/** Statuses after which the follow up stops and nobody chases the prospect. */
export const STOP_STATUSES: ContractStatus[] = ["changes_requested", "awaiting_countersign", "signed", "declined", "cancelled", "shared"];

export const CONTRACTS_BUCKET = "contract-documents";
