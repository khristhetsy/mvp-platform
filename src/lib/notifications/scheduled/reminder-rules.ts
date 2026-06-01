import { reminderCadenceHours } from "@/lib/notifications/scheduled/cadence";
import type { ReminderKind } from "@/lib/notifications/scheduled/types";
import { isActionOverdue, isPastSlaWithoutDueAt } from "@/lib/notifications/orchestration/due-dates";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

export const MAX_REMINDERS_PER_PASS = 25;

export function reminderDedupeKey(kind: ReminderKind, actionId: string, recipientUserId: string): string {
  return `sched_reminder:${kind}:${actionId}:${recipientUserId}`;
}

export function shouldRemindForRow(row: NextBestActionRecord): { kind: ReminderKind; trigger: string } | null {
  if (!row.user_id) return null;

  if (row.status === "snoozed" && row.snoozed_until) {
    const until = new Date(row.snoozed_until).getTime();
    if (until <= Date.now() && until >= Date.now() - 24 * 60 * 60 * 1000) {
      return { kind: "follow_up", trigger: "snooze_expired" };
    }
    return null;
  }

  if (isActionOverdue(row)) {
    if (row.priority === "critical" || row.category === "compliance") {
      return { kind: "escalation_warning", trigger: "critical_overdue" };
    }
    return { kind: "reminder", trigger: "action_overdue" };
  }

  if (row.status === "escalated") {
    return { kind: "escalation_warning", trigger: "action_escalated" };
  }

  if (row.status === "blocked") {
    return { kind: "workflow_attention", trigger: "workflow_blocked" };
  }

  if (row.category === "compliance" && row.priority === "critical") {
    return { kind: "workflow_attention", trigger: "critical_compliance" };
  }

  if (row.category === "spv" && (isActionOverdue(row) || isPastSlaWithoutDueAt(row))) {
    return { kind: "reminder", trigger: "spv_requirement" };
  }

  if (row.action_type.includes("onboarding")) {
    return { kind: "inactivity_warning", trigger: "onboarding_inactivity" };
  }

  if (row.action_type.includes("remediation") && isPastSlaWithoutDueAt(row)) {
    return { kind: "follow_up", trigger: "remediation_unresolved" };
  }

  if (row.action_type.includes("approval") || row.action_type.includes("investor_approval")) {
    return { kind: "workflow_attention", trigger: "pending_approval" };
  }

  if (row.action_type.includes("import_failed") || row.source_module === "imports") {
    return { kind: "workflow_attention", trigger: "failed_import" };
  }

  return null;
}

export function reminderTitle(kind: ReminderKind, row: NextBestActionRecord): string {
  switch (kind) {
    case "follow_up":
      return row.status === "snoozed" ? `Snoozed action active: ${row.title}` : `Follow-up: ${row.title}`;
    case "escalation_warning":
      return `Escalation warning: ${row.title}`;
    case "inactivity_warning":
      return `Inactivity: ${row.title}`;
    case "workflow_attention":
      return `Attention needed: ${row.title}`;
    default:
      return `Reminder: ${row.title}`;
  }
}

export function reminderMessage(row: NextBestActionRecord, trigger: string): string {
  const reason = row.reason?.trim();
  if (reason) return reason.slice(0, 280);
  switch (trigger) {
    case "snooze_expired":
      return "A snoozed action is active again. Review it in your Action Center.";
    case "action_overdue":
      return "This workflow action is overdue. Complete or reschedule it in your Action Center.";
    case "failed_import":
      return "A recent import needs operational follow-up.";
    default:
      return "Review this item in your Action Center.";
  }
}

export function reminderSeverity(kind: ReminderKind, row: NextBestActionRecord): "critical" | "high" | "medium" | "info" {
  if (kind === "escalation_warning" || row.priority === "critical") return "critical";
  if (kind === "workflow_attention" || row.priority === "high") return "high";
  if (kind === "inactivity_warning") return "medium";
  return "info";
}

export { reminderCadenceHours };
