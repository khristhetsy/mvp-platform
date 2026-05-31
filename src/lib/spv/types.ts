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
  created_at: string;
  updated_at: string;
  companies?: { company_name?: string | null; slug?: string | null } | null;
};

export type SpvParticipationRecord = {
  id: string;
  spv_opportunity_id: string;
  investor_id: string;
  company_id: string;
  indicative_amount: number | null;
  status: SpvParticipationStatus | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};
