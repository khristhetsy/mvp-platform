import { actionCenterBasePath } from "@/lib/actions/filters";
import {
  MAX_REMINDERS_PER_PASS,
  reminderDedupeKey,
  reminderMessage,
  reminderSeverity,
  reminderTitle,
  shouldRemindForRow,
} from "@/lib/notifications/scheduled/reminder-rules";
import type { ScheduledReminder } from "@/lib/notifications/scheduled/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

export function scanRemindersFromActions(rows: NextBestActionRecord[]): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (reminders.length >= MAX_REMINDERS_PER_PASS) break;
    const match = shouldRemindForRow(row);
    if (!match || !row.user_id) continue;

    const dedupeKey = reminderDedupeKey(match.kind, row.id, row.user_id);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    reminders.push({
      kind: match.kind,
      trigger: match.trigger,
      title: reminderTitle(match.kind, row),
      message: reminderMessage(row, match.trigger),
      recipientUserId: row.user_id,
      severity: reminderSeverity(match.kind, row),
      dedupeKey,
      deepLink: row.href ?? actionCenterBasePath(row.role),
      actionId: row.id,
      entityType: "next_best_action",
      entityId: row.id,
    });
  }

  return reminders;
}
