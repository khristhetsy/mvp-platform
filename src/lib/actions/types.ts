import type {
  NextBestAction,
  NextBestActionCategory,
  NextBestActionLifecycleStatus,
  NextBestActionPriority,
  NextBestActionRole,
} from "@/lib/next-best-actions/types";

export type ActionCenterTab = "active" | "overdue" | "escalated" | "completed" | "snoozed";

export type ActionCenterFilters = {
  tab: ActionCenterTab;
  status?: NextBestActionLifecycleStatus;
  priority?: NextBestActionPriority;
  category?: NextBestActionCategory;
  entityType?: string;
  companyId?: string;
  investorId?: string;
  spvId?: string;
  overdue?: boolean;
  escalated?: boolean;
  q?: string;
  assignedToMe?: boolean;
  limit: number;
  offset: number;
};

export type ActionCenterAnalytics = {
  open: number;
  overdue: number;
  escalated: number;
  completedThisWeek: number;
  completedToday: number;
  critical: number;
  blocked: number;
  snoozed: number;
  byPriority: Record<NextBestActionPriority, number>;
  byCategory: Record<string, number>;
  readinessImpact?: number;
  pendingRequirements?: number;
  activeOpportunities?: number;
};

export type ActionCenterListResult = {
  actions: NextBestAction[];
  total: number;
  analytics: ActionCenterAnalytics;
  role: NextBestActionRole;
  basePath: string;
};

export type ActionCenterDetail = {
  action: NextBestAction;
  workspaceHref: string | null;
  timeline: ActionTimelineItem[];
};

export type ActionTimelineItem = {
  id: string;
  event_type: string;
  title: string;
  created_at: string;
  severity: string;
  category: string;
};

export type BulkActionType = "complete" | "dismiss" | "snooze" | "escalate";
