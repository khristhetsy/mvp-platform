import type { ActionOrchestrationHints } from "@/lib/notifications/orchestration/types";
import type { NextBestAction } from "@/lib/next-best-actions/types";

function isDisplayOverdue(action: NextBestAction): boolean {
  if (action.status === "overdue") return true;
  if (!action.dueAt) return false;
  if (!action.status || !["open", "snoozed", "blocked"].includes(action.status)) return false;
  return new Date(action.dueAt).getTime() < Date.now();
}

export function getActionOrchestrationHints(action: NextBestAction): ActionOrchestrationHints {
  const overdue = isDisplayOverdue(action);
  const escalated = action.status === "escalated";
  const blocked = action.status === "blocked";
  const inactivity = Boolean(action.metadata?.orchestration_inactivity);
  const reminder = Boolean(action.metadata?.orchestration_reminder) || (overdue && action.priority !== "critical");

  return {
    overdue,
    escalated,
    blocked,
    inactivity,
    reminder,
    needsAttention: overdue || escalated || blocked || action.priority === "critical",
  };
}

export function needsAttentionGroup(actions: NextBestAction[]): NextBestAction[] {
  return actions.filter((a) => getActionOrchestrationHints(a).needsAttention);
}
