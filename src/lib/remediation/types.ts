export type RemediationCategory =
  | "company_profile"
  | "documents"
  | "financials"
  | "governance"
  | "market"
  | "investor_materials"
  | "readiness"
  | "compliance";

export type RemediationPriority = "high" | "medium" | "low";

export type RemediationStatus = "open" | "in_progress" | "completed" | "dismissed";

export type RemediationTaskRecord = {
  id: string;
  company_id: string;
  founder_id: string;
  source_type: string;
  source_key: string;
  category: RemediationCategory;
  title: string;
  description: string;
  priority: RemediationPriority;
  status: RemediationStatus;
  recommended_action: string;
  related_feature: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type RemediationTaskDraft = {
  source_type: string;
  source_key: string;
  category: RemediationCategory;
  title: string;
  description: string;
  priority: RemediationPriority;
  recommended_action: string;
  related_feature: string | null;
};
