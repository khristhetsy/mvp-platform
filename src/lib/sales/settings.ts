import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type SalesSettings = {
  taskTypes: string[];
  remindTaskDue: boolean;
  remindStalled: boolean;
  stalledDays: number;
};

export const SALES_DEFAULTS: SalesSettings = {
  taskTypes: ["Call", "Email", "Demo", "Follow-up", "Proposal"],
  remindTaskDue: true,
  remindStalled: true,
  stalledDays: 14,
};

export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    const { data } = await db().from("sales_settings").select("task_types, remind_task_due, remind_stalled, stalled_days").eq("id", "default").maybeSingle();
    if (!data) return SALES_DEFAULTS;
    return {
      taskTypes: Array.isArray(data.task_types) && data.task_types.length ? data.task_types : SALES_DEFAULTS.taskTypes,
      remindTaskDue: Boolean(data.remind_task_due),
      remindStalled: Boolean(data.remind_stalled),
      stalledDays: data.stalled_days ?? SALES_DEFAULTS.stalledDays,
    };
  } catch {
    return SALES_DEFAULTS;
  }
}

export async function updateSalesSettings(patch: Partial<SalesSettings>): Promise<void> {
  const update: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.taskTypes !== undefined) update.task_types = patch.taskTypes.map((t) => t.trim()).filter(Boolean).slice(0, 30);
  if (patch.remindTaskDue !== undefined) update.remind_task_due = patch.remindTaskDue;
  if (patch.remindStalled !== undefined) update.remind_stalled = patch.remindStalled;
  if (patch.stalledDays !== undefined) update.stalled_days = Math.max(1, Math.min(90, Math.round(patch.stalledDays)));
  const { error } = await db().from("sales_settings").upsert(update, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
