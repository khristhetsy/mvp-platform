import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hasRecentOrchestrationNotification } from "@/lib/notifications/notifications";
import type { OrchestrationFinding } from "@/lib/notifications/orchestration/types";
import type { NotificationRecord } from "@/lib/notifications/types";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { Database } from "@/lib/supabase/types";

export type DeliverOrchestrationInput = OrchestrationFinding & {
  notificationType?: string;
};

function mapOrchestrationEventType(finding: OrchestrationFinding): string {
  switch (finding.orchestrationType) {
    case "overdue":
      return "workflow_overdue_detected";
    case "escalation":
      return "workflow_escalated";
    case "inactivity":
      return "workflow_inactivity_detected";
    case "digest":
      return "digest_generated";
    case "reminder":
      return "reminder_generated";
    default:
      if (finding.trigger === "action_escalated") return "workflow_escalated";
      if (finding.trigger === "action_overdue") return "workflow_overdue_detected";
      return "reminder_generated";
  }
}

export async function deliverOrchestrationFinding(
  finding: DeliverOrchestrationInput,
  options?: { dedupeHours?: number },
): Promise<{ created: boolean; notification: NotificationRecord | null; eventEmitted: boolean }> {
  const admin = createServiceRoleClient();
  const dedupeHours = options?.dedupeHours ?? 24;

  const duplicate = await hasRecentOrchestrationNotification({
    recipientUserId: finding.recipientUserId,
    dedupeKey: finding.dedupeKey,
    withinHours: dedupeHours,
  });

  if (duplicate) {
    return { created: false, notification: null, eventEmitted: false };
  }

  const payload: Database["public"]["Tables"]["notifications"]["Insert"] = {
    recipient_user_id: finding.recipientUserId,
    type: finding.notificationType ?? `orchestration_${finding.orchestrationType}`,
    title: finding.title.slice(0, 200),
    message: finding.message.slice(0, 500),
    entity_type: finding.entityType ?? null,
    entity_id: finding.entityId ?? finding.actionId ?? null,
    severity: finding.severity,
    orchestration_type: finding.orchestrationType,
    action_id: finding.actionId ?? null,
    deep_link: finding.deepLink ?? null,
    dedupe_key: finding.dedupeKey,
  };

  const { data, error } = await admin.from("notifications").insert(payload).select("*").single();

  const eventType = mapOrchestrationEventType(finding);
  emitOperationalEvent(admin, {
    eventType,
    eventCategory: "system",
    entityType: finding.entityType ?? "workflow",
    entityId: finding.entityId ?? finding.actionId ?? null,
    companyId: finding.companyId ?? null,
    investorId: finding.investorId ?? null,
    spvId: finding.spvId ?? null,
    relatedUserId: finding.recipientUserId,
    severity: finding.severity === "critical" ? "critical" : finding.severity === "high" ? "high" : "medium",
    title: finding.title.slice(0, 120),
    description: null,
    metadata: sanitizeOperationalMetadata({
      trigger: finding.trigger,
      orchestration_type: finding.orchestrationType,
      action_id: finding.actionId,
      deep_link: finding.deepLink,
      inactivity_reason: finding.inactivityReason,
      escalation_target: finding.escalationTarget,
      dedupe_key: finding.dedupeKey,
    }),
    sourceModule: "notification_orchestration",
    visibility: finding.role === "admin" || finding.role === "analyst" ? "admin_only" : "company_related",
    dedupeKey: `orch_event:${finding.dedupeKey}`,
    dedupeWindowMinutes: 60 * 12,
  });

  if (error || !data) {
    return { created: false, notification: null, eventEmitted: true };
  }

  return { created: true, notification: data as NotificationRecord, eventEmitted: true };
}

export function normalizeOrchestrationFinding(
  partial: Partial<OrchestrationFinding> & Pick<OrchestrationFinding, "trigger" | "recipientUserId" | "title" | "message" | "dedupeKey">,
): OrchestrationFinding {
  return {
    orchestrationType: partial.orchestrationType ?? "reminder",
    severity: partial.severity ?? "medium",
    role: partial.role ?? "founder",
    entityType: partial.entityType ?? null,
    entityId: partial.entityId ?? null,
    companyId: partial.companyId ?? null,
    investorId: partial.investorId ?? null,
    spvId: partial.spvId ?? null,
    actionId: partial.actionId ?? null,
    deepLink: partial.deepLink ?? null,
    escalationTarget: partial.escalationTarget,
    inactivityReason: partial.inactivityReason,
    suggestedAction: partial.suggestedAction,
    trigger: partial.trigger,
    recipientUserId: partial.recipientUserId,
    title: partial.title,
    message: partial.message,
    dedupeKey: partial.dedupeKey,
  };
}
