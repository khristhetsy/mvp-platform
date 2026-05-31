export const OPERATIONAL_EVENT_CATEGORIES = [
  "crm",
  "onboarding",
  "diligence",
  "compliance",
  "spv",
  "investor",
  "founder",
  "reporting",
  "messaging",
  "outreach",
  "system",
  "imports",
  "analytics",
] as const;

export type OperationalEventCategory = (typeof OPERATIONAL_EVENT_CATEGORIES)[number];

export const OPERATIONAL_EVENT_VISIBILITIES = [
  "admin_only",
  "internal",
  "founder",
  "investor",
  "company_related",
  "public_summary",
] as const;

export type OperationalEventVisibility = (typeof OPERATIONAL_EVENT_VISIBILITIES)[number];

export const OPERATIONAL_EVENT_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type OperationalEventSeverity = (typeof OPERATIONAL_EVENT_SEVERITIES)[number];

export type CreateOperationalEventInput = {
  eventType: string;
  eventCategory: OperationalEventCategory;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  companyId?: string | null;
  investorId?: string | null;
  spvId?: string | null;
  relatedUserId?: string | null;
  severity?: OperationalEventSeverity;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  sourceModule: string;
  visibility?: OperationalEventVisibility;
  dedupeKey?: string | null;
  dedupeWindowMinutes?: number;
};

export type OperationalActivityFeedItem = {
  id: string;
  event_type: string;
  event_category: OperationalEventCategory;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  company_id: string | null;
  investor_id: string | null;
  spv_id: string | null;
  severity: OperationalEventSeverity;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  source_module: string;
  visibility: OperationalEventVisibility;
  created_at: string;
  actor_name: string | null;
  company_name: string | null;
};

export type OperationalActivityFeedFilters = {
  category?: OperationalEventCategory | OperationalEventCategory[];
  companyId?: string;
  investorId?: string;
  spvId?: string;
  severity?: OperationalEventSeverity | OperationalEventSeverity[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type OperationalActivityFeedResult = {
  items: OperationalActivityFeedItem[];
  total: number;
  hasMore: boolean;
};

/** Queue / workflow metadata shape for future automation. */
export type OperationalWorkflowMetadata = {
  workflow_state?: "blocked" | "overdue" | "at_risk" | "on_track" | "completed";
  blocked_reason?: string;
  due_at?: string;
  escalation_level?: number;
  remediation_task_id?: string;
  bottleneck_key?: string;
};
