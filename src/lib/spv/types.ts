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
