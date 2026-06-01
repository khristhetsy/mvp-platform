import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hasRecentOrchestrationNotification } from "@/lib/notifications/notifications";
import { reminderCadenceHours } from "@/lib/notifications/scheduled/reminder-rules";
import type { ScheduledReminder } from "@/lib/notifications/scheduled/types";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";

export async function deliverScheduledReminder(
  reminder: ScheduledReminder,
): Promise<{ created: boolean; eventEmitted: boolean }> {
  const admin = createServiceRoleClient();
  const withinHours = reminderCadenceHours(reminder.kind);

  const duplicate = await hasRecentOrchestrationNotification({
    recipientUserId: reminder.recipientUserId,
    dedupeKey: reminder.dedupeKey,
    withinHours,
  });

  if (duplicate) {
    return { created: false, eventEmitted: false };
  }

  const notificationType =
    reminder.kind === "escalation_warning"
      ? "escalation_warning"
      : reminder.kind === "workflow_attention"
        ? "workflow_attention"
        : "reminder_generated";

  const { error } = await admin.from("notifications").insert({
    recipient_user_id: reminder.recipientUserId,
    type: notificationType,
    title: reminder.title.slice(0, 200),
    message: reminder.message.slice(0, 500),
    entity_type: reminder.entityType ?? null,
    entity_id: reminder.entityId ?? null,
    severity: reminder.severity,
    orchestration_type: "reminder_generated",
    action_id: reminder.actionId ?? null,
    deep_link: reminder.deepLink ?? null,
    dedupe_key: reminder.dedupeKey,
  });

  emitOperationalEvent(admin, {
    eventType: "reminder_sent",
    eventCategory: "system",
    entityType: reminder.entityType ?? "next_best_action",
    entityId: reminder.entityId ?? reminder.actionId ?? null,
    relatedUserId: reminder.recipientUserId,
    severity: reminder.severity === "critical" ? "critical" : reminder.severity === "high" ? "high" : "medium",
    title: reminder.title.slice(0, 120),
    description: null,
    metadata: sanitizeOperationalMetadata({
      trigger: reminder.trigger,
      reminder_kind: reminder.kind,
      dedupe_key: reminder.dedupeKey,
    }),
    sourceModule: "scheduled_reminders",
    visibility: "company_related",
    dedupeKey: `reminder_event:${reminder.dedupeKey}`,
    dedupeWindowMinutes: 60 * withinHours,
  });

  emitOperationalEvent(admin, {
    eventType: "workflow_attention_detected",
    eventCategory: "system",
    entityType: reminder.entityType ?? "workflow",
    entityId: reminder.entityId ?? null,
    relatedUserId: reminder.recipientUserId,
    severity: "info",
    title: "Workflow attention",
    description: null,
    metadata: sanitizeOperationalMetadata({ trigger: reminder.trigger }),
    sourceModule: "scheduled_reminders",
    visibility: "company_related",
    dedupeKey: `workflow_attention:${reminder.dedupeKey}`,
    dedupeWindowMinutes: 60 * 12,
  });

  return { created: !error, eventEmitted: true };
}

export async function deliverScheduledReminders(reminders: ScheduledReminder[]) {
  let sent = 0;
  let skipped = 0;
  let eventsEmitted = 0;

  for (const reminder of reminders) {
    const result = await deliverScheduledReminder(reminder);
    if (result.created) sent += 1;
    else skipped += 1;
    if (result.eventEmitted) eventsEmitted += 1;
  }

  return { sent, skipped, eventsEmitted };
}
