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

export const NEXT_BEST_ACTION_STATUSES = [
  "open",
  "snoozed",
  "dismissed",
  "completed",
  "overdue",
  "escalated",
  "blocked",
] as const;
export type NextBestActionLifecycleStatus = (typeof NEXT_BEST_ACTION_STATUSES)[number];

export const ACTIVE_NBA_STATUSES: NextBestActionLifecycleStatus[] = [
  "open",
  "snoozed",
  "overdue",
  "blocked",
  "escalated",
];

export type NextBestAction = {
  /** Computed logical id (action_type key). */
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
  /** Persisted row id when lifecycle is synced. */
  persistedId?: string;
  status?: NextBestActionLifecycleStatus;
  dueAt?: string | null;
  snoozedUntil?: string | null;
  dismissedAt?: string | null;
  completedAt?: string | null;
  escalatedAt?: string | null;
};

export type NextBestActionRecord = {
  id: string;
  user_id: string | null;
  role: NextBestActionRole;
  entity_type: string | null;
  entity_id: string | null;
  company_id: string | null;
  investor_id: string | null;
  spv_id: string | null;
  action_type: string;
  title: string;
  description: string;
  priority: NextBestActionPriority;
  category: NextBestActionCategory;
  status: NextBestActionLifecycleStatus;
  href: string;
  source_module: string;
  source_event_id: string | null;
  reason: string | null;
  blockers: unknown;
  metadata: Record<string, unknown>;
  dedupe_key: string;
  source_signature: string;
  due_at: string | null;
  snoozed_until: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ComputeNextBestActionsOptions = {
  role?: NextBestActionRole;
  contextPath?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  /** Sync computed actions into persisted lifecycle rows. */
  sync?: boolean;
  /** Include dismissed/completed in response (default false). */
  includeInactive?: boolean;
};

export type NextBestActionsResult = {
  actions: NextBestAction[];
  role: NextBestActionRole;
  disclaimer: string;
};

export const NBA_DISCLAIMER =
  "Suggested actions are operational guidance only and do not constitute legal, tax, investment, or securities advice.";
