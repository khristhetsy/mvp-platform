import type { NextBestActionRole } from "@/lib/next-best-actions/types";
import type { OperationalEventSeverity } from "@/lib/operational-activity/types";

export const ORCHESTRATION_NOTIFICATION_TYPES = [
  "reminder",
  "escalation",
  "overdue",
  "digest",
  "inactivity",
  "workflow_blocked",
  "workflow_progress",
  "admin_attention",
] as const;

export type OrchestrationNotificationType = (typeof ORCHESTRATION_NOTIFICATION_TYPES)[number];

export const ORCHESTRATION_TRIGGER_KINDS = [
  "action_overdue",
  "action_escalated",
  "critical_compliance_action",
  "founder_onboarding_stalled",
  "investor_approval_stalled",
  "spv_blocked",
  "investor_requirements_overdue",
  "remediation_unresolved",
  "failed_import",
  "workflow_inactivity",
  "unread_critical_admin_actions",
] as const;

export type OrchestrationTriggerKind = (typeof ORCHESTRATION_TRIGGER_KINDS)[number];

export type OrchestrationSeverity = OperationalEventSeverity;

export type EscalationTarget = "admin" | "spv_ops" | "founder" | "investor";

export type OrchestrationFinding = {
  trigger: OrchestrationTriggerKind;
  orchestrationType: OrchestrationNotificationType;
  severity: OrchestrationSeverity;
  title: string;
  message: string;
  recipientUserId: string;
  role: NextBestActionRole | "founder" | "investor" | "admin" | "analyst";
  entityType?: string | null;
  entityId?: string | null;
  companyId?: string | null;
  investorId?: string | null;
  spvId?: string | null;
  actionId?: string | null;
  deepLink?: string | null;
  dedupeKey: string;
  escalationTarget?: EscalationTarget;
  inactivityReason?: string;
  suggestedAction?: string;
};

export type OrchestrationRunResult = {
  scannedActions: number;
  findings: number;
  notificationsCreated: number;
  eventsEmitted: number;
  skippedDuplicates: number;
};

export type OrchestrationDigestItem = {
  id: string;
  title: string;
  severity: OrchestrationSeverity;
  orchestrationType: OrchestrationNotificationType;
  deepLink?: string | null;
  trigger?: OrchestrationTriggerKind;
};

export type OrchestrationDigest = {
  role: NextBestActionRole | "founder" | "investor" | "admin";
  generatedAt: string;
  critical: OrchestrationDigestItem[];
  overdue: OrchestrationDigestItem[];
  escalated: OrchestrationDigestItem[];
  blocked: OrchestrationDigestItem[];
  recommendedNext: OrchestrationDigestItem[];
};

export type OrchestrationSummary = {
  overdueCount: number;
  escalatedCount: number;
  blockedCount: number;
  stalledCount: number;
  needsAttentionCount: number;
  highlights: string[];
};

export type ActionOrchestrationHints = {
  overdue: boolean;
  escalated: boolean;
  blocked: boolean;
  inactivity: boolean;
  reminder: boolean;
  needsAttention: boolean;
};
