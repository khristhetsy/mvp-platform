import { actionCenterBasePath } from "@/lib/actions/filters";
import { isActionOverdue, isPastSlaWithoutDueAt, overdueSeverity, resolveSlaRuleKey } from "@/lib/notifications/orchestration/due-dates";
import { resolveEscalationTarget } from "@/lib/notifications/orchestration/escalation";
import type { OrchestrationFinding, OrchestrationTriggerKind } from "@/lib/notifications/orchestration/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

function deepLinkForAction(row: NextBestActionRecord): string {
  const base = actionCenterBasePath(row.role);
  if (row.status === "overdue") return `${base}?tab=overdue&overdue=true`;
  if (row.status === "escalated") return `${base}?tab=escalated&escalated=true`;
  if (row.priority === "critical") return `${base}?priority=critical`;
  return base;
}

function normalizeTitle(prefix: string, row: NextBestActionRecord): string {
  return `${prefix}: ${row.title}`.slice(0, 120);
}

function sanitizeMessage(row: NextBestActionRecord): string {
  const reason = row.reason?.trim();
  if (!reason) return "Review this workflow item in your Action Center.";
  return reason.slice(0, 280);
}

export function evaluateActionTriggers(row: NextBestActionRecord): OrchestrationFinding[] {
  const findings: OrchestrationFinding[] = [];
  if (!row.user_id) return findings;
  if (!["open", "overdue", "blocked", "escalated", "snoozed"].includes(row.status)) {
    return findings;
  }

  const recipientUserId = row.user_id;
  const deepLink = deepLinkForAction(row);
  const base = {
    recipientUserId,
    role: row.role,
    entityType: row.entity_type ?? "next_best_action",
    entityId: row.id,
    companyId: row.company_id,
    investorId: row.investor_id,
    spvId: row.spv_id,
    actionId: row.id,
    deepLink,
  };

  if (isActionOverdue(row) || isPastSlaWithoutDueAt(row)) {
    const sev = overdueSeverity(row);
    findings.push({
      ...base,
      trigger: "action_overdue",
      orchestrationType: "overdue",
      severity: sev === "critical" ? "critical" : sev === "high" ? "high" : "medium",
      title: normalizeTitle("Overdue action", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:overdue:${row.id}`,
      escalationTarget: resolveEscalationTarget(row) ?? undefined,
      suggestedAction: "Open Action Center to complete or snooze this item.",
    });
  }

  if (row.status === "escalated") {
    findings.push({
      ...base,
      trigger: "action_escalated",
      orchestrationType: "escalation",
      severity: row.priority === "critical" ? "critical" : "high",
      title: normalizeTitle("Escalated action", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:escalated:${row.id}`,
      escalationTarget: resolveEscalationTarget(row) ?? undefined,
    });
  }

  if (row.category === "compliance" && row.priority === "critical" && row.status !== "completed") {
    findings.push({
      ...base,
      trigger: "critical_compliance_action",
      orchestrationType: "admin_attention",
      severity: "critical",
      title: normalizeTitle("Critical compliance", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:compliance_critical:${row.id}`,
      escalationTarget: "admin",
    });
  }

  if (row.status === "blocked") {
    findings.push({
      ...base,
      trigger: "spv_blocked",
      orchestrationType: "workflow_blocked",
      severity: row.priority === "critical" ? "critical" : "high",
      title: normalizeTitle("Blocked workflow", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:blocked:${row.id}`,
    });
  }

  if (row.action_type.includes("onboarding") && row.role === "founder") {
    findings.push({
      ...base,
      trigger: "founder_onboarding_stalled",
      orchestrationType: "inactivity",
      severity: "medium",
      title: normalizeTitle("Onboarding attention", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:onboarding:${row.company_id ?? row.id}`,
      inactivityReason: "Founder onboarding progress has not advanced recently.",
      suggestedAction: row.href,
    });
  }

  if (row.action_type.includes("investor_approval") || row.action_type.includes("approval_pending")) {
    findings.push({
      ...base,
      trigger: "investor_approval_stalled",
      orchestrationType: "admin_attention",
      severity: "high",
      title: normalizeTitle("Investor approval pending", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:investor_approval:${row.investor_id ?? row.id}`,
      escalationTarget: "admin",
    });
  }

  if (
    row.category === "spv" &&
    (row.action_type.includes("requirement") || row.source_module === "spv_requirements")
  ) {
    const overdue = isActionOverdue(row);
    if (overdue) {
      findings.push({
        ...base,
        trigger: "investor_requirements_overdue",
        orchestrationType: "overdue",
        severity: "high",
        title: normalizeTitle("SPV requirement overdue", row),
        message: sanitizeMessage(row),
        dedupeKey: `orch:spv_req_overdue:${row.id}`,
        escalationTarget: "spv_ops",
      });
    }
  }

  if (row.action_type.includes("remediation") || row.action_type.includes("readiness_remediation")) {
    if (isActionOverdue(row) || isPastSlaWithoutDueAt(row)) {
      findings.push({
        ...base,
        trigger: "remediation_unresolved",
        orchestrationType: "overdue",
        severity: "medium",
        title: normalizeTitle("Remediation unresolved", row),
        message: sanitizeMessage(row),
        dedupeKey: `orch:remediation:${row.company_id ?? row.id}`,
        escalationTarget: "admin",
      });
    }
  }

  if (row.action_type.includes("import_failed") || row.source_module === "imports") {
    findings.push({
      ...base,
      trigger: "failed_import",
      orchestrationType: "workflow_blocked",
      severity: "high",
      title: normalizeTitle("Import needs attention", row),
      message: sanitizeMessage(row),
      dedupeKey: `orch:import_failed:${row.id}`,
      escalationTarget: "admin",
    });
  }

  if (row.role === "admin" || row.role === "analyst") {
    if (row.priority === "critical" && ["open", "overdue", "escalated"].includes(row.status)) {
      findings.push({
        ...base,
        trigger: "unread_critical_admin_actions",
        orchestrationType: "reminder",
        severity: "critical",
        title: normalizeTitle("Critical admin action", row),
        message: sanitizeMessage(row),
        dedupeKey: `orch:admin_critical:${row.id}`,
      });
    }
  }

  const slaRule = resolveSlaRuleKey(row);
  if (slaRule && !isActionOverdue(row) && row.due_at) {
    const dueMs = new Date(row.due_at).getTime();
    const hoursLeft = (dueMs - Date.now()) / (60 * 60 * 1000);
    if (hoursLeft > 0 && hoursLeft <= 12) {
      findings.push({
        ...base,
        trigger: "action_overdue",
        orchestrationType: "reminder",
        severity: "info",
        title: normalizeTitle("Due soon", row),
        message: `This item is due within ${Math.ceil(hoursLeft)} hours.`,
        dedupeKey: `orch:reminder:${row.id}:${Math.floor(dueMs / 86400000)}`,
      });
    }
  }

  return findings;
}

export function triggerLabel(kind: OrchestrationTriggerKind): string {
  return kind.replaceAll("_", " ");
}
