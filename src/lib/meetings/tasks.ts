// Weekly Meeting System — Step 2 task layer. Meeting tasks with dual notes + carryover
// (open tasks from prior sessions of the same meeting). Service-role reads via admin
// routes gated by requireRole; ceo_note writes are admin-only (guarded in the API layer).
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type TaskPriority = "urgent" | "high" | "med" | "low";
export type TaskStatus = "not_started" | "in_progress" | "done" | "cancelled";

export interface MeetingTask {
  id: string; title: string; department_id: string | null; department_name: string | null;
  assignee_id: string | null; assignee_name: string | null; priority: TaskPriority; status: TaskStatus;
  start_date: string | null; due_date: string | null; session_id: string | null; source: string;
  agent_note: string | null; ceo_note: string | null; created_at: string; completed_at: string | null;
}

const SELECT = "id, title, department_id, assignee_id, priority, status, start_date, due_date, session_id, source, agent_note, ceo_note, created_at, completed_at";

async function enrich(rows: Array<Record<string, unknown>>): Promise<MeetingTask[]> {
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter((x): x is string => Boolean(x)))];
  const userIds = [...new Set(rows.map((r) => r.assignee_id).filter((x): x is string => Boolean(x)))];
  const deptNames = new Map<string, string>();
  const userNames = new Map<string, string>();
  if (deptIds.length) {
    const { data } = await db().from("departments").select("id, name").in("id", deptIds);
    for (const d of (data ?? []) as Array<{ id: string; name: string }>) deptNames.set(d.id, d.name);
  }
  if (userIds.length) {
    const { data } = await db().from("profiles").select("id, full_name, email").in("id", userIds);
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) userNames.set(p.id, p.full_name ?? p.email ?? "Member");
  }
  return rows.map((r) => ({
    id: String(r.id), title: String(r.title),
    department_id: (r.department_id as string) ?? null, department_name: r.department_id ? deptNames.get(String(r.department_id)) ?? null : null,
    assignee_id: (r.assignee_id as string) ?? null, assignee_name: r.assignee_id ? userNames.get(String(r.assignee_id)) ?? null : null,
    priority: (r.priority as TaskPriority) ?? "high", status: (r.status as TaskStatus) ?? "not_started",
    start_date: (r.start_date as string) ?? null, due_date: (r.due_date as string) ?? null,
    session_id: (r.session_id as string) ?? null, source: (r.source as string) ?? "manual",
    agent_note: (r.agent_note as string) ?? null, ceo_note: (r.ceo_note as string) ?? null,
    created_at: String(r.created_at), completed_at: (r.completed_at as string) ?? null,
  }));
}

export async function listSessionTasks(sessionId: string): Promise<MeetingTask[]> {
  const { data } = await db().from("ceo_meeting_tasks").select(SELECT).eq("session_id", sessionId).order("created_at", { ascending: false });
  return enrich((data ?? []) as Array<Record<string, unknown>>);
}

/** Open tasks carried over from prior sessions of the same meeting (+ session-less dept tasks). */
export async function listCarryover(sessionId: string): Promise<MeetingTask[]> {
  const { data: sess } = await db().from("ceo_meeting_sessions").select("meeting_key, session_date").eq("id", sessionId).maybeSingle();
  if (!sess) return [];
  const { data: prior } = await db().from("ceo_meeting_sessions")
    .select("id").eq("meeting_key", sess.meeting_key).lt("session_date", sess.session_date);
  const priorIds = ((prior ?? []) as Array<{ id: string }>).map((r) => r.id);

  const open = "status.in.(not_started,in_progress)";
  let q = db().from("ceo_meeting_tasks").select(SELECT).or(open);
  // open tasks either from a prior session or with no session (standing dept tasks)
  if (priorIds.length) q = q.or(`session_id.in.(${priorIds.join(",")}),session_id.is.null`);
  else q = q.is("session_id", null);
  const { data } = await q;
  const tasks = await enrich((data ?? []) as Array<Record<string, unknown>>);
  // Overdue first, then by due date.
  return tasks.filter((t) => t.status === "not_started" || t.status === "in_progress")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

export interface CreateTaskInput {
  title: string; department_id?: string | null; assignee_id?: string | null;
  priority?: TaskPriority; due_date?: string | null; start_date?: string | null;
  session_id?: string | null; source?: string;
}
export async function createMeetingTask(input: CreateTaskInput, createdBy: string): Promise<MeetingTask> {
  const { data, error } = await db().from("ceo_meeting_tasks").insert({
    title: input.title, department_id: input.department_id ?? null, assignee_id: input.assignee_id ?? null,
    priority: input.priority ?? "high", due_date: input.due_date ?? null, start_date: input.start_date ?? null,
    session_id: input.session_id ?? null, source: input.source ?? "manual", created_by: createdBy,
  }).select(SELECT).single();
  if (error) throw new Error(error.message);
  return (await enrich([data as Record<string, unknown>]))[0];
}

export interface UpdateTaskPatch {
  status?: TaskStatus; assignee_id?: string | null; priority?: TaskPriority;
  due_date?: string | null; agent_note?: string | null; ceo_note?: string | null;
}
/** Update a task. `allowCeoNote` gates the CEO-only note column. */
export async function updateMeetingTask(id: string, patch: UpdateTaskPatch, allowCeoNote: boolean): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.status) { update.status = patch.status; update.completed_at = patch.status === "done" ? new Date().toISOString() : null; }
  if (patch.assignee_id !== undefined) update.assignee_id = patch.assignee_id;
  if (patch.priority) update.priority = patch.priority;
  if (patch.due_date !== undefined) update.due_date = patch.due_date;
  if (patch.agent_note !== undefined) update.agent_note = patch.agent_note;
  if (patch.ceo_note !== undefined && allowCeoNote) update.ceo_note = patch.ceo_note;
  if (Object.keys(update).length === 0) return;
  const { error } = await db().from("ceo_meeting_tasks").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Departments + assignable staff for the New Task modal. */
export async function loadMeetingMeta(): Promise<{ departments: Array<{ id: string; name: string }>; staff: Array<{ id: string; name: string }> }> {
  const [{ data: depts }, { data: staff }] = await Promise.all([
    db().from("departments").select("id, name").eq("is_active", true).order("name"),
    db().from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]).order("full_name"),
  ]);
  return {
    departments: ((depts ?? []) as Array<{ id: string; name: string }>).map((d) => ({ id: d.id, name: d.name })),
    staff: ((staff ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Member" })),
  };
}
