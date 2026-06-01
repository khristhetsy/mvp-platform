import type { ReminderKind, ScheduledDigestType } from "@/lib/notifications/scheduled/types";

export type CadenceKind = "daily" | "weekly" | "business_days_only" | "every_24h" | "every_72h";

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

export function isBusinessDay(date = new Date()): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function cadenceWindowMs(kind: CadenceKind): number {
  switch (kind) {
    case "daily":
    case "every_24h":
      return MS_DAY;
    case "weekly":
      return MS_WEEK;
    case "every_72h":
      return 3 * MS_DAY;
    case "business_days_only":
      return MS_DAY;
    default:
      return MS_DAY;
  }
}

export function digestCadenceForType(type: ScheduledDigestType): CadenceKind {
  switch (type) {
    case "admin_daily_digest":
    case "critical_overdue_digest":
      return "daily";
    case "founder_weekly_digest":
    case "investor_weekly_digest":
      return "weekly";
    case "spv_blocker_digest":
      return "every_72h";
    case "compliance_attention_digest":
      return "every_24h";
    default:
      return "daily";
  }
}

export function shouldRunCadence(
  lastRunAt: string | null | undefined,
  kind: CadenceKind,
  options?: { force?: boolean; now?: Date },
): boolean {
  if (options?.force) return true;
  if (!lastRunAt) return true;

  const now = options?.now ?? new Date();
  if (kind === "business_days_only" && !isBusinessDay(now)) {
    return false;
  }

  const elapsed = now.getTime() - new Date(lastRunAt).getTime();
  return elapsed >= cadenceWindowMs(kind);
}

export function reminderCadenceHours(kind: ReminderKind): number {
  switch (kind) {
    case "escalation_warning":
      return 12;
    case "workflow_attention":
      return 24;
    case "inactivity_warning":
      return 48;
    case "follow_up":
      return 24;
    default:
      return 24;
  }
}
