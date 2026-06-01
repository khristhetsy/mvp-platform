import type { AutomationPlannedAction } from "@/lib/automation/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

export function planRepeatedOverdueEscalation(
  rows: NextBestActionRecord[],
  staffUserId: string,
): AutomationPlannedAction[] {
  const actions: AutomationPlannedAction[] = [];
  const overdueByType = new Map<string, number>();

  for (const row of rows) {
    if (row.status !== "overdue" && row.status !== "escalated") continue;
    overdueByType.set(row.action_type, (overdueByType.get(row.action_type) ?? 0) + 1);
  }

  for (const [actionType, count] of overdueByType) {
    if (count < 2) continue;
    const sample = rows.find((r) => r.action_type === actionType);
    if (!sample) continue;

    actions.push({
      ruleId: `admin_repeated_overdue_${actionType}`,
      actionType: "escalation_visibility",
      title: "Repeated overdue pattern",
      reason: `Action type ${actionType} appears overdue multiple times.`,
      dedupeKey: `auto:escalation:repeat:${actionType}:${new Date().toISOString().slice(0, 10)}`,
      targetUserId: staffUserId,
      notification: {
        type: "workflow_attention",
        title: "Repeated overdue workflow pattern",
        message: `Multiple overdue items detected for ${actionType}. Review in Action Center.`,
      },
      operationalEvent: {
        eventType: "workflow_automation_triggered",
        title: "Repeated overdue escalation",
      },
    });
  }

  return actions;
}

export function planCriticalComplianceEscalation(
  companyId: string,
  staffUserId: string,
): AutomationPlannedAction {
  return {
    ruleId: "admin_critical_compliance",
    actionType: "create_nba",
    title: "Critical compliance escalation",
    reason: "Unresolved compliance requires admin attention.",
    dedupeKey: `auto:compliance:critical:${companyId}`,
    targetUserId: staffUserId,
    nba: {
      id: `admin_compliance_critical_${companyId}`,
      role: "admin",
      title: "Critical compliance review",
      description: "Compliance escalation requires operational follow-up.",
      priority: "critical",
      category: "compliance",
      entityType: "company",
      entityId: companyId,
      companyId,
      href: `/admin/compliance`,
      sourceModule: "workflow_automation",
      reason: "Automated escalation for unresolved compliance.",
      blockers: [],
      createdFrom: "workflow_automation",
      metadata: { automation_rule: "admin_critical_compliance" },
    },
    operationalEvent: {
      eventType: "workflow_automation_triggered",
      title: "Critical compliance automation",
    },
  };
}
