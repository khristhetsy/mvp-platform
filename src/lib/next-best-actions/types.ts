export const NEXT_BEST_ACTION_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type NextBestActionPriority = (typeof NEXT_BEST_ACTION_PRIORITIES)[number];

export const NEXT_BEST_ACTION_CATEGORIES = [
  "onboarding",
  "readiness",
  "compliance",
  "investor_engagement",
  "spv",
  "documents",
  "reporting",
  "outreach",
  "admin_review",
  "system",
] as const;
export type NextBestActionCategory = (typeof NEXT_BEST_ACTION_CATEGORIES)[number];

export const NEXT_BEST_ACTION_ROLES = ["founder", "investor", "admin", "analyst"] as const;
export type NextBestActionRole = (typeof NEXT_BEST_ACTION_ROLES)[number];

export type NextBestAction = {
  id: string;
  role: NextBestActionRole;
  title: string;
  description: string;
  priority: NextBestActionPriority;
  category: NextBestActionCategory;
  entityType: string;
  entityId?: string;
  companyId?: string;
  investorId?: string;
  spvId?: string;
  href: string;
  sourceModule: string;
  reason: string;
  blockers: string[];
  createdFrom: string;
  metadata: Record<string, unknown>;
  /** Internal tie-break (ISO timestamp or sortable string). */
  urgencyAt?: string;
};

export type ComputeNextBestActionsOptions = {
  role?: NextBestActionRole;
  contextPath?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
};

export type NextBestActionsResult = {
  actions: NextBestAction[];
  role: NextBestActionRole;
  disclaimer: string;
};

export const NBA_DISCLAIMER =
  "Suggested actions are operational guidance only and do not constitute legal, tax, investment, or securities advice.";
