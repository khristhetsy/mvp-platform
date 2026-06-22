// Data access for admin tasks. Tables aren't in generated Supabase types yet, so
// we use a raw cast. Callers pass a service-role client (routes/pages already
// gate on staff). RLS (is_staff) is the second line of defense.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  AdminTask,
  AdminTaskActivity,
  AdminTaskAttachment,
  AdminTaskDetail,
  AdminTaskListItem,
  TaskStatus,
} from "./types";
import type { CreateTaskInput, UpdateTaskInput } from "./schemas";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const TASK_COLS =
  "id, title, description, status, priority, assignee_id, owner_label, due_date, visibility, tags, position, created_by, created_at, updated_at, archived_at";

export async function listTasks(
  supabase: SupabaseClient<Database>,
  filters?: { status?: TaskStatus; assignee?: string; q?: string },
): Promise<AdminTaskListItem[]> {
  let query = raw(supabase)
    .from("admin_tasks")
    .select(`${TASK_COLS}, admin_task_attachments(count)`)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assignee) query = query.eq("assignee_id", filters.assignee);
  if (filters?.q) query = query.ilike("title", `%${filters.q}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data as Array<AdminTask & { admin_task_attachments?: Array<{ count: number }> }>) ?? []).map((t) => ({
    ...t,
    attachment_count: t.admin_task_attachments?.[0]?.count ?? 0,
  }));
}

export async function getTaskDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AdminTaskDetail | null> {
  const { data: task, error } = await raw(supabase).from("admin_tasks").select(TASK_COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) return null;

  const [{ data: attachments }, { data: activity }] = await Promise.all([
    raw(supabase).from("admin_task_attachments").select("*").eq("task_id", id).order("created_at", { ascending: true }),
    raw(supabase).from("admin_task_activity").select("*").eq("task_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    task: task as AdminTask,
    attachments: (attachments as AdminTaskAttachment[]) ?? [],
    activity: (activity as AdminTaskActivity[]) ?? [],
  };
}

export async function createTask(
  supabase: SupabaseClient<Database>,
  createdBy: string,
  input: CreateTaskInput,
): Promise<AdminTask> {
  const { data, error } = await raw(supabase)
    .from("admin_tasks")
    .insert({
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId ?? null,
      owner_label: input.ownerLabel ?? null,
      due_date: input.dueDate ?? null,
      visibility: input.visibility,
      tags: input.tags ?? [],
      created_by: createdBy,
    })
    .select(TASK_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as AdminTask;
}

export async function getTaskRow(supabase: SupabaseClient<Database>, id: string): Promise<AdminTask | null> {
  const { data } = await raw(supabase).from("admin_tasks").select(TASK_COLS).eq("id", id).maybeSingle();
  return (data as AdminTask) ?? null;
}

export async function updateTask(
  supabase: SupabaseClient<Database>,
  id: string,
  input: UpdateTaskInput,
): Promise<AdminTask> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId ?? null;
  if (input.ownerLabel !== undefined) patch.owner_label = input.ownerLabel ?? null;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate ?? null;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.position !== undefined) patch.position = input.position;

  const { data, error } = await raw(supabase).from("admin_tasks").update(patch).eq("id", id).select(TASK_COLS).single();
  if (error) throw new Error(error.message);
  return data as AdminTask;
}

export async function archiveTask(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await raw(supabase).from("admin_tasks").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertAttachment(
  supabase: SupabaseClient<Database>,
  row: Omit<AdminTaskAttachment, "created_at">,
): Promise<AdminTaskAttachment> {
  const { data, error } = await raw(supabase).from("admin_task_attachments").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as AdminTaskAttachment;
}

export async function getAttachment(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AdminTaskAttachment | null> {
  const { data } = await raw(supabase).from("admin_task_attachments").select("*").eq("id", id).maybeSingle();
  return (data as AdminTaskAttachment) ?? null;
}

export async function deleteAttachmentRow(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await raw(supabase).from("admin_task_attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
