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
  created_at: string;
  updated_at: string;
  companies?: { company_name?: string | null; slug?: string | null } | null;
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
