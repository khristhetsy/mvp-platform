// Sales tasks / activities — standalone. Loose client (sales_* not in gen types).
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type SalesTask = {
  id: string; title: string; task_type: string; summary: string | null; due_date: string | null;
  status: "open" | "done" | "snoozed"; assignee_id: string | null; assignee_name: string | null;
  opportunity_id: string | null; contact_crm_id: string | null; contact_name: string | null;
  created_at: string; done_at: string | null;
};

const SELECT = "id, title, task_type, summary, due_date, status, assignee_id, opportunity_id, contact_crm_id, contact_name, created_at, done_at, assignee:profiles!sales_tasks_assignee_id_fkey(full_name, email)";

function mapRow(r: Record<string, unknown>): SalesTask {
  const a = r.assignee as { full_name?: string | null; email?: string | null } | null;
  return {
    id: String(r.id), title: String(r.title), task_type: (r.task_type as string) ?? "Call",
    summary: (r.summary as string) ?? null, due_date: (r.due_date as string) ?? null,
    status: (r.status as SalesTask["status"]) ?? "open", assignee_id: (r.assignee_id as string) ?? null,
    assignee_name: a?.full_name ?? a?.email ?? null,
    opportunity_id: (r.opportunity_id as string) ?? null, contact_crm_id: (r.contact_crm_id as string) ?? null,
    contact_name: (r.contact_name as string) ?? null, created_at: String(r.created_at), done_at: (r.done_at as string) ?? null,
  };
}

export async function listTasks(opts: { scope?: "my" | "all" | "overdue"; assigneeId?: string | null; opportunityId?: string | null; contactCrmId?: string | null } = {}): Promise<SalesTask[]> {
  let q = db().from("sales_tasks").select(SELECT).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (opts.opportunityId) q = q.eq("opportunity_id", opts.opportunityId);
  if (opts.contactCrmId) q = q.eq("contact_crm_id", opts.contactCrmId);
  if (opts.scope === "my" && opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
  if (opts.scope === "overdue") q = q.eq("status", "open").lt("due_date", new Date().toISOString().slice(0, 10));
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export type CreateTaskInput = {
  title: string; taskType?: string; summary?: string | null; dueDate?: string | null;
  assigneeId?: string | null; opportunityId?: string | null; contactCrmId?: string | null; contactName?: string | null; createdBy?: string | null;
};

export async function createTask(input: CreateTaskInput): Promise<SalesTask | null> {
  const { data, error } = await db().from("sales_tasks").insert({
    title: input.title.trim(), task_type: input.taskType || "Call", summary: input.summary || null,
    due_date: input.dueDate || null, assignee_id: input.assigneeId || null,
    opportunity_id: input.opportunityId || null, contact_crm_id: input.contactCrmId || null, contact_name: input.contactName || null,
    created_by: input.createdBy || null,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Create failed.");
  const { data: row } = await db().from("sales_tasks").select(SELECT).eq("id", data.id).maybeSingle();
  return row ? mapRow(row as Record<string, unknown>) : null;
}

export async function updateTask(id: string, patch: { status?: SalesTask["status"]; title?: string; taskType?: string; summary?: string | null; dueDate?: string | null; assigneeId?: string | null }): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) { update.status = patch.status; update.done_at = patch.status === "done" ? new Date().toISOString() : null; }
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.taskType !== undefined) update.task_type = patch.taskType;
  if (patch.summary !== undefined) update.summary = patch.summary;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId || null;
  const { error } = await db().from("sales_tasks").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await db().from("sales_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
