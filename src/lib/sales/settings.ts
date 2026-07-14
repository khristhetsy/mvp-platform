import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type SalesSettings = {
  taskTypes: string[];
  defaultAssigneeId: string | null;
  remindTaskDue: boolean;
  remindStalled: boolean;
  remindClosePassed: boolean;
  stalledDays: number;
  leadAssigneeIds: string[]; // members eligible for a contact's "Assigned to"; empty = all
};

export const SALES_DEFAULTS: SalesSettings = {
  taskTypes: ["Call", "Email", "Demo", "Follow-up", "Proposal"],
  defaultAssigneeId: null,
  remindTaskDue: true,
  remindStalled: true,
  remindClosePassed: false,
  stalledDays: 14,
  leadAssigneeIds: [],
};

export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    const { data } = await db().from("sales_settings").select("task_types, default_assignee_id, remind_task_due, remind_stalled, remind_close_passed, stalled_days, lead_assignee_ids").eq("id", "default").maybeSingle();
    if (!data) return SALES_DEFAULTS;
    return {
      taskTypes: Array.isArray(data.task_types) && data.task_types.length ? data.task_types : SALES_DEFAULTS.taskTypes,
      defaultAssigneeId: (data.default_assignee_id as string) ?? null,
      remindTaskDue: Boolean(data.remind_task_due),
      remindStalled: Boolean(data.remind_stalled),
      remindClosePassed: Boolean(data.remind_close_passed),
      stalledDays: data.stalled_days ?? SALES_DEFAULTS.stalledDays,
      leadAssigneeIds: Array.isArray(data.lead_assignee_ids) ? (data.lead_assignee_ids as string[]) : [],
    };
  } catch {
    return SALES_DEFAULTS;
  }
}

export async function updateSalesSettings(patch: Partial<SalesSettings>): Promise<void> {
  const update: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.taskTypes !== undefined) update.task_types = patch.taskTypes.map((t) => t.trim()).filter(Boolean).slice(0, 30);
  if (patch.defaultAssigneeId !== undefined) update.default_assignee_id = patch.defaultAssigneeId || null;
  if (patch.remindTaskDue !== undefined) update.remind_task_due = patch.remindTaskDue;
  if (patch.remindStalled !== undefined) update.remind_stalled = patch.remindStalled;
  if (patch.remindClosePassed !== undefined) update.remind_close_passed = patch.remindClosePassed;
  if (patch.stalledDays !== undefined) update.stalled_days = Math.max(1, Math.min(90, Math.round(patch.stalledDays)));
  if (patch.leadAssigneeIds !== undefined) update.lead_assignee_ids = Array.from(new Set(patch.leadAssigneeIds.filter(Boolean)));
  const { error } = await db().from("sales_settings").upsert(update, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// Staff (admin/analyst) options for the default-assignee selector.
export async function listAssignableStaff(): Promise<{ id: string; name: string }[]> {
  const { data } = await db().from("profiles").select("id, full_name, email, role").in("role", ["admin", "analyst"]).order("full_name", { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Staff" }));
}

// Members eligible to appear in a contact's "Assigned to" picker. When the admin has
// not restricted the list (empty), every staff member is eligible.
export async function listLeadAssignableStaff(): Promise<{ id: string; name: string }[]> {
  const [staff, settings] = await Promise.all([listAssignableStaff(), getSalesSettings()]);
  if (settings.leadAssigneeIds.length === 0) return staff;
  const allow = new Set(settings.leadAssigneeIds);
  return staff.filter((s) => allow.has(s.id));
}
