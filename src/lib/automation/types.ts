import type { NextBestAction } from "@/lib/next-best-actions/types";
import type { OperationalEventSeverity } from "@/lib/operational-activity/types";

export const AUTOMATION_TRIGGER_TYPES = [
  "operational_event",
  "nba_lifecycle",
  "onboarding_progress",
  "remediation_update",
  "readiness_threshold",
  "investor_approval",
  "spv_requirement",
  "package_readiness",
  "compliance_resolution",
  "import_failure",
  "queue_escalation",
  "inactivity",
  "scheduled_scan",
] as const;

export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = [
  "create_nba",
  "update_nba_status",
  "create_notification",
  "create_reminder",
  "escalation_visibility",
  "operational_event",
  "workflow_summary",
  "readiness_recompute",
  "follow_up_task",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export type WorkflowDependency = {
  id: string;
  blocker: string;
  dependency: string;
  severity: OperationalEventSeverity;
  nextRequiredStep: string;
  entityType: string;
  entityId: string;
  resolved: boolean;
  href?: string | null;
};

export type AutomationTriggerContext = {
  triggerType: AutomationTriggerType;
  eventType?: string | null;
  sourceEventId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  companyId?: string | null;
  investorId?: string | null;
  spvId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AutomationPlannedAction = {
  ruleId: string;
  actionType: AutomationActionType;
  title: string;
  reason: string;
  dedupeKey: string;
  targetUserId?: string | null;
  nba?: Partial<NextBestAction>;
  notification?: { title: string; message: string; type: string };
  operationalEvent?: { eventType: string; title: string };
  metadata?: Record<string, unknown>;
};

export type AutomationRuleResult = {
  ruleId: string;
  status: "executed" | "skipped" | "failed";
  message: string;
  actionType?: AutomationActionType;
};

export type AutomationEngineResult = {
  success: boolean;
  dryRun: boolean;
  runId: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  automationsTriggered: number;
  actionsCreated: number;
  blockersDetected: number;
  dependenciesResolved: number;
  skippedRules: number;
  failures: number;
  results: AutomationRuleResult[];
  dependencies: WorkflowDependency[];
  errors: Array<{ step: string; message: string }>;
};

export type AutomationDailySummary = {
  automationsTriggeredToday: number;
  blockedWorkflows: number;
  dependenciesResolvedToday: number;
  automationFailuresToday: number;
  staleChains: number;
};
