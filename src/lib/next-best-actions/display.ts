import type { AssistantSuggestedAction } from "@/lib/assistant/types";
import type {
  NextBestAction,
  NextBestActionLifecycleStatus,
  NextBestActionPriority,
} from "@/lib/next-best-actions/types";

const PRIORITY_BADGE_CLASS: Record<NextBestActionPriority, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-900 border-amber-200",
  medium: "bg-indigo-50 text-indigo-800 border-indigo-100",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

export function priorityBadgeClass(priority: NextBestActionPriority): string {
  return PRIORITY_BADGE_CLASS[priority];
}

export function formatPriorityLabel(priority: NextBestActionPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

const STATUS_BADGE_CLASS: Record<NextBestActionLifecycleStatus, string> = {
  open: "bg-slate-100 text-slate-700 border-slate-200",
  snoozed: "bg-violet-50 text-violet-800 border-violet-100",
  dismissed: "bg-slate-100 text-slate-500 border-slate-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-100",
  overdue: "bg-red-50 text-red-800 border-red-100",
  escalated: "bg-amber-50 text-amber-900 border-amber-200",
  blocked: "bg-orange-50 text-orange-900 border-orange-200",
};

export function statusBadgeClass(status: NextBestActionLifecycleStatus | undefined): string {
  if (!status) return STATUS_BADGE_CLASS.open;
  return STATUS_BADGE_CLASS[status];
}

export function formatStatusLabel(status: NextBestActionLifecycleStatus | undefined): string {
  if (!status) return "Open";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function panelTitleForRole(role: string): string {
  switch (role) {
    case "investor":
      return "What matters now";
    case "admin":
    case "analyst":
      return "Operational priorities";
    default:
      return "What to do next";
  }
}

export function toAssistantSuggestedActions(actions: NextBestAction[]): AssistantSuggestedAction[] {
  const priorityMap: Record<NextBestActionPriority, AssistantSuggestedAction["priority"]> = {
    critical: "high",
    high: "high",
    medium: "medium",
    low: "low",
  };

  const typeMap: Record<string, AssistantSuggestedAction["type"]> = {
    compliance: "compliance",
    readiness: "report",
    documents: "workflow",
    reporting: "report",
    spv: "workflow",
    outreach: "workflow",
    onboarding: "workflow",
    investor_engagement: "workflow",
    admin_review: "workflow",
    system: "workflow",
  };

  return actions.map((action) => ({
    label: action.title,
    href: action.href,
    type: typeMap[action.category] ?? "workflow",
    priority: priorityMap[action.priority],
  }));
}

export function formatActionsForAssistantAnswer(actions: NextBestAction[]): string {
  if (actions.length === 0) {
    return "No prioritized actions were computed for your current workspace state.";
  }

  return actions
    .slice(0, 5)
    .map((action, index) => {
      const status = action.status ? ` [${formatStatusLabel(action.status)}]` : "";
      return `${index + 1}. **${action.title}**${status} — ${action.reason}`;
    })
    .join("\n");
}
