export const SPV_OPPORTUNITY_STATUSES = [
  "draft",
  "under_review",
  "open",
  "closed",
  "canceled",
] as const;

export type SpvOpportunityStatus = (typeof SPV_OPPORTUNITY_STATUSES)[number];

export const SPV_PARTICIPATION_STATUSES = [
  "invited",
  "interested",
  "soft_committed",
  "documents_pending",
  "completed",
  "declined",
  "canceled",
] as const;

export type SpvParticipationStatus = (typeof SPV_PARTICIPATION_STATUSES)[number];

export const SPV_CHECKLIST_CATEGORIES = [
  "legal",
  "investor_docs",
  "banking",
  "compliance",
  "tax",
  "reporting",
  "admin",
] as const;

export type SpvChecklistCategory = (typeof SPV_CHECKLIST_CATEGORIES)[number];

export const SPV_CHECKLIST_STATUSES = ["pending", "in_progress", "completed", "waived"] as const;

export type SpvChecklistItemStatus = (typeof SPV_CHECKLIST_STATUSES)[number];

export type SpvChecklistItemRecord = {
  id: string;
  spv_opportunity_id: string;
  item_key: string;
  title: string;
  description: string | null;
  category: SpvChecklistCategory | string;
  status: SpvChecklistItemStatus | string;
  required: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SpvOpportunityRecord = {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  target_amount: number | null;
  minimum_commitment: number | null;
  status: SpvOpportunityStatus | string;
  description: string | null;
  terms_summary: string | null;
  checklist_readiness_pct?: number | null;
  document_ready_at?: string | null;
  investors_document_ready_count?: number | null;
  investor_pending_requirements_count?: number | null;
  operational_readiness_status?: string | null;
  target_amount_reached_notified?: boolean | null;
  package_readiness_pct?: number | null;
  investor_package_status?: string | null;
  packages_fully_approved_notified?: boolean | null;
  closing_readiness_pct?: number | null;
  investor_closing_status?: string | null;
  closing_final_review_notified?: boolean | null;
  closing_approved_notified?: boolean | null;
  closing_target_override?: boolean | null;
  created_at: string;
  updated_at: string;
  companies?: { company_name?: string | null; slug?: string | null } | null;
};

export const SPV_CLOSING_REVIEW_STATUSES = [
  "not_started",
  "in_review",
  "approved_for_closing",
  "changes_required",
  "closed_operationally",
  "canceled",
] as const;

export type SpvClosingReviewStatus = (typeof SPV_CLOSING_REVIEW_STATUSES)[number];

export type SpvClosingReviewRecord = {
  id: string;
  spv_opportunity_id: string;
  company_id: string;
  status: SpvClosingReviewStatus | string;
  readiness_snapshot: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  spv_opportunities?: { name?: string | null } | null;
};

export const SPV_PARTICIPATION_REQUIREMENT_CATEGORIES = [
  "subscription_docs",
  "accreditation",
  "kyc_aml",
  "tax",
  "banking",
  "admin_review",
] as const;

export type SpvParticipationRequirementCategory =
  (typeof SPV_PARTICIPATION_REQUIREMENT_CATEGORIES)[number];

export const SPV_PARTICIPATION_REQUIREMENT_STATUSES = [
  "pending",
  "uploaded",
  "under_review",
  "approved",
  "rejected",
  "waived",
] as const;

export type SpvParticipationRequirementStatus =
  (typeof SPV_PARTICIPATION_REQUIREMENT_STATUSES)[number];

export const SPV_DOCUMENT_PACKAGE_TYPES = [
  "formation_package",
  "subscription_package",
  "investor_intake_package",
  "banking_package",
  "tax_package",
  "reporting_package",
  "final_closing_package",
] as const;

export type SpvDocumentPackageType = (typeof SPV_DOCUMENT_PACKAGE_TYPES)[number];

export const SPV_DOCUMENT_PACKAGE_STATUSES = [
  "not_started",
  "preparing",
  "under_review",
  "approved",
  "issued",
  "archived",
] as const;

export type SpvDocumentPackageStatus = (typeof SPV_DOCUMENT_PACKAGE_STATUSES)[number];

export type SpvDocumentPackageRecord = {
  id: string;
  spv_opportunity_id: string;
  company_id: string;
  package_type: SpvDocumentPackageType | string;
  status: SpvDocumentPackageStatus | string;
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  prepared_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  spv_opportunities?: { name?: string | null } | null;
};

export type SpvParticipationRequirementRecord = {
  id: string;
  spv_participation_id: string;
  spv_opportunity_id: string;
  investor_id: string;
  requirement_key: string;
  title: string;
  description: string | null;
  category: SpvParticipationRequirementCategory | string;
  status: SpvParticipationRequirementStatus | string;
  required: boolean;
  uploaded_document_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  spv_opportunities?: { name?: string | null; status?: string | null } | null;
  documents?: {
    id: string;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  } | null;
};

export type SpvParticipationRecord = {
  id: string;
  spv_opportunity_id: string;
  investor_id: string;
  company_id: string;
  indicative_amount: number | null;
  status: SpvParticipationStatus | string;
  notes: string | null;
  document_readiness_pct?: number | null;
  document_ready_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};
