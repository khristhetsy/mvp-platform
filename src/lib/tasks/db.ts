import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Task, CreateTaskInput, UpdateTaskInput, InternalUser } from "./types";

// Cast to any to bypass generated type gaps (same pattern as marketingDb)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tasksDb(): Promise<any> {
  return createServerSupabaseClient();
}

/** List tasks visible to the current user (RLS applies).
 *  No joins — created_by → auth.users (not profiles), so we skip server-side
 *  joins and resolve names in the UI from the internalUsers list.
 */
export async function listTasks(): Promise<Task[]> {
  const db = await tasksDb();
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Task[];
}

/** List tasks created by or assigned to a specific user. */
export async function listUserTasks(userId: string): Promise<Task[]> {
  const db = await tasksDb();
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Task[];
}

/** Create a task. created_by is set server-side from the session. */
export async function createTask(
  userId: string,
  input: CreateTaskInput
): Promise<Task> {
  const db = await tasksDb();
  const { data, error } = await db
    .from("tasks")
    .insert({
      title:        input.title,
      description:  input.description ?? null,
      created_by:   userId,
      assigned_to:  input.assigned_to ?? null,
      priority:     input.priority ?? "medium",
      due_date:     input.due_date ?? null,
      context_type: input.context_type ?? "personal",
      context_id:   input.context_id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Task;
}

/** Update a task by ID. */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const db = await tasksDb();
  const { data, error } = await db
    .from("tasks")
    .update({
      ...(input.title       !== undefined && { title:       input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.assigned_to !== undefined && { assigned_to: input.assigned_to }),
      ...(input.status      !== undefined && { status:      input.status }),
      ...(input.priority                !== undefined && { priority:                input.priority }),
      ...(input.due_date               !== undefined && { due_date:               input.due_date }),
      ...(input.google_calendar_event_id !== undefined && { google_calendar_event_id: input.google_calendar_event_id }),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Task;
}

/** Delete a task by ID. */
export async function deleteTask(id: string): Promise<void> {
  const db = await tasksDb();
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Get internal users (admin + analyst roles) for the assignee dropdown. */
export async function listInternalUsers(): Promise<InternalUser[]> {
  const db = await tasksDb();
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["admin", "analyst"])
    .order("full_name");

  if (error) throw new Error(error.message);
  return data as InternalUser[];
}
