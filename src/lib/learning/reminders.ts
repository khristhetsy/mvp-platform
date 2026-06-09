import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { LearningReminderRecord, LearningReminderType } from "@/lib/learning/types";

export async function scheduleReminder(input: {
  founderId: string;
  companyId: string;
  type: LearningReminderType;
  scheduledAt: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_reminders")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      type: input.type,
      scheduled_at: input.scheduledAt,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to schedule reminder: ${error?.message ?? "unknown"}`);
  }

  return data as LearningReminderRecord;
}

export async function getPendingReminders(asOf?: string) {
  const admin = createServiceRoleClient();
  const now = asOf ?? new Date().toISOString();
  const { data, error } = await admin
    .from("learning_reminders")
    .select("*")
    .is("sent_at", null)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load pending reminders: ${error.message}`);
  }

  return (data ?? []) as LearningReminderRecord[];
}
