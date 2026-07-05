// Operations tasks — data access. Service-role only; called from admin API routes.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, notifyStaff } from "@/lib/notifications/notifications";

// ops_tasks isn't in the generated Supabase types yet — cast the client loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

export type OpsTask = {
  id: string;
  title: string;
  entity_type: string;
  entity_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "done";
  archived: boolean;
  created_at: string;
};

export type Assignee = { id: string; name: string };

export async function listAssignees(): Promise<Assignee[]> {
  const { data } = await db().from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]);
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
    .map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Staff" }));
}

export async function listTasks(entityType: string, entityId: string): Promise<OpsTask[]> {
  const { data } = await db()
    .from("ops_tasks")
    .select("id, title, entity_type, entity_id, assignee_id, due_date, status, archived, created_at, assignee:profiles!ops_tasks_assignee_id_fkey(full_name,email)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("archived", false)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    entity_type: String(r.entity_type),
    entity_id: String(r.entity_id),
    assignee_id: (r.assignee_id as string) ?? null,
    assignee_name: ((r.assignee as { full_name?: string; email?: string } | null)?.full_name)
      ?? ((r.assignee as { full_name?: string; email?: string } | null)?.email) ?? null,
    due_date: (r.due_date as string) ?? null,
    status: (r.status as OpsTask["status"]) ?? "open",
    archived: Boolean(r.archived),
    created_at: String(r.created_at),
  }));
}

export async function createTask(input: {
  title: string; entityType: string; entityId: string; assigneeId?: string | null; dueDate?: string | null; createdBy?: string | null;
}): Promise<OpsTask | null> {
  const { data, error } = await db()
    .from("ops_tasks")
    .insert({
      title: input.title.trim(),
      entity_type: input.entityType,
      entity_id: input.entityId,
      assignee_id: input.assigneeId || null,
      due_date: input.dueDate || null,
      created_by: input.createdBy || null,
    })
    .select("id")
    .single();
  if (error || !data) return null;

  // Notify the assignee (or the whole staff pool if unassigned) — like escalations.
  const title = "New task assigned";
  const message = `${input.title.trim()}${input.dueDate ? ` · due ${input.dueDate}` : ""}`;
  if (input.assigneeId) {
    await createNotification({
      recipientUserId: input.assigneeId,
      type: "operations.task_assigned",
      title,
      message,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: "normal",
    });
  } else {
    await notifyStaff({ type: "operations.task_assigned", title, message: `Unassigned: ${message}`, entityType: input.entityType, entityId: input.entityId, severity: "normal" });
  }

  const list = await listTasks(input.entityType, input.entityId);
  return list.find((t) => t.id === String(data.id)) ?? null;
}

export async function updateTask(id: string, patch: {
  title?: string; assigneeId?: string | null; dueDate?: string | null; status?: OpsTask["status"]; archived?: boolean;
}): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId || null;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.archived !== undefined) update.archived = patch.archived;
  const { error } = await db().from("ops_tasks").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  // If reassigned, tell the new owner.
  if (patch.assigneeId) {
    const { data } = await db().from("ops_tasks").select("title, entity_type, entity_id").eq("id", id).maybeSingle();
    const row = data as { title?: string; entity_type?: string; entity_id?: string } | null;
    if (row) {
      await createNotification({
        recipientUserId: patch.assigneeId,
        type: "operations.task_assigned",
        title: "Task assigned to you",
        message: row.title ?? "Task",
        entityType: row.entity_type ?? null,
        entityId: row.entity_id ?? null,
        severity: "normal",
      });
    }
  }
}
