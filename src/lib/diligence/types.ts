// Due Diligence module — shared types. Tables (dd_*) are not in the generated
// Supabase types yet, so these mirror migration 20260621004_dd_module.sql.

export type Stage =
  | "draft"
  | "sent_to_founder"
  | "responding"
  | "admin_review"
  | "consent_requested"
  | "consented_locked"
  | "released";

export type Severity = "high" | "medium" | "low";
export type FindingStatus = "open" | "mitigating" | "resolved";
export type Verification = "unverified" | "requested" | "submitted" | "verified" | "discrepancy";
export type Disposition = "agree" | "remediating" | "clarify" | "dispute" | "awaiting";
export type Review = "accepted" | "needs_more" | "open";
export type DiligenceRole = "admin" | "founder" | "investor";
export type GateSection = "findings" | "responses" | "data_room" | "candor" | "icfo_review" | "verdict";
export type RiskRating = "high" | "medium" | "low";

export interface Engagement {
  id: string;
  company_name: string;
  company_slug: string;
  round_label: string | null;
  sector: string | null;
  report_code: string;
  lifecycle_stage: Stage;
  posture: string | null;
  recommendation: string | null;
  confidence_pct: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  engagement_id: string;
  code: string;
  name: string;
  overview: string | null;
  strengths: unknown[];
  mitigation: unknown[];
  conclusion: string | null;
  risk_rating: RiskRating | null;
  sort_order: number | null;
}

export interface Finding {
  id: string;
  engagement_id: string;
  finding_code: string;
  domain_id: string | null;
  title: string;
  detail: string | null;
  severity: Severity;
  status: FindingStatus;
  verification: Verification;
  source: string | null;
  internal_note?: string | null; // candor layer — admin only
  created_at: string;
}

export interface Claim {
  id: string;
  engagement_id: string;
  claim: string;
  claimed_value: string | null;
  source_asserted: string | null;
  verification: Verification;
  finding_id: string | null;
  weight: number;
}

export const SEVERITIES: Severity[] = ["high", "medium", "low"];
export const FINDING_STATUSES: FindingStatus[] = ["open", "mitigating", "resolved"];
export const VERIFICATIONS: Verification[] = ["unverified", "requested", "submitted", "verified", "discrepancy"];

// Tailwind/UI tokens from the spec (§2).
export const DD_COLORS = {
  ink: "#0c1826",
  brand: "#2f6cb0",
  brandDeep: "#234f86",
  high: "#b42318",
  med: "#b06a00",
  low: "#5d6b7e",
  verified: "#1d7a4d",
  info: "#2f6cb0",
} as const;
