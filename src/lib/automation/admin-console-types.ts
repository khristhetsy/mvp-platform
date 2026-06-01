import type { AutomationRuleResult } from "@/lib/automation/types";

export type AutomationRunStatus = "running" | "success" | "partial" | "failed";

export type AutomationConsoleFilters = {
  status?: AutomationRunStatus;
  triggerType?: string;
  dryRun?: boolean;
  entityType?: string;
  failuresOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  limit: number;
  offset: number;
};

export type SanitizedAutomationRunMetadata = {
  blockers_detected?: number;
  dependencies_resolved?: number;
  results?: AutomationRuleResult[];
  errors?: Array<{ step: string; message: string }>;
  executed_dedupe_keys?: string[];
};

export type AutomationRunListItem = {
  id: string;
  status: AutomationRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  triggerType: string | null;
  sourceEventId: string | null;
  entityType: string | null;
  entityId: string | null;
  dryRun: boolean;
  actionsExecuted: number;
  actionsSkipped: number;
  failuresCount: number;
  blockersDetected: number;
  dependenciesResolved: number;
  automationsTriggered: number;
};

export type AutomationActionListItem = {
  id: string;
  actionType: string;
  status: string;
  message: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  createdAt: string;
  skipReason: string | null;
  dedupeKey: string | null;
};

export type AutomationRunDetail = AutomationRunListItem & {
  metadata: SanitizedAutomationRunMetadata;
  actions: AutomationActionListItem[];
  relatedEvents: Array<{
    id: string;
    eventType: string;
    title: string;
    createdAt: string;
    entityType: string | null;
    entityId: string | null;
  }>;
};

export type AutomationConsoleStats = {
  runsToday: number;
  failuresToday: number;
  blockedWorkflows: number;
  automationsTriggeredToday: number;
  dependenciesResolvedToday: number;
  avgDurationMs: number;
};

export type AutomationCronVisibility = {
  lastOrchestrationAt: string | null;
  lastOrchestrationStatus: string | null;
  cronAutomationRunsToday: number;
  manualRunsToday: number;
  failedCronOrchestrationToday: number;
};

export type AutomationSafetySummary = {
  dryRunsToday: number;
  guardSkipsToday: number;
  dedupePreventionsToday: number;
  cooldownSkipsToday: number;
  recursionPreventionsToday: number;
};

export type AutomationTimelineItem = {
  id: string;
  eventType: string;
  title: string;
  createdAt: string;
  severity: string;
};

export type AutomationDependencyInsight = {
  id: string;
  label: string;
  count: number;
  href: string | null;
};

export type AutomationRuleFrequency = {
  ruleId: string;
  count: number;
};

export type AutomationConsolePayload = {
  runs: AutomationRunListItem[];
  total: number;
  stats: AutomationConsoleStats;
  cron: AutomationCronVisibility;
  safety: AutomationSafetySummary;
  timeline: AutomationTimelineItem[];
  topBlockers: AutomationDependencyInsight[];
  ruleFrequency: AutomationRuleFrequency[];
};
