// Weekly Meeting System — Step 6 Plan of Action.
// Departmental (or company-level) objectives with milestone checklists. Progress is
// derived from milestones done / total. Objectives are archived, never hard-deleted.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type ObjectiveStatus = "on_track" | "at_risk" | "off_track" | "done";
const STATUSES = new Set<ObjectiveStatus>(["on_track", "at_risk", "off_track", "done"]);

export interface Milestone {
  id: string; objective_id: string; title: string; owner_id: string | null; owner_name: string | null;
  due_date: string | null; done: boolean; position: number;
}
export interface Objective {
  id: string; department_id: string | null; department_name: string | null; title: string;
  description: string | null; period_label: string | null; target_date: string | null;
  status: ObjectiveStatus; position: number;
  milestones: Milestone[]; progress: number; // 0..100
}

export interface CreateObjectiveInput {
  department_id?: string | null; title: string; description?: string | null;
  period_label?: string | null; target_date?: string | null; status?: ObjectiveStatus;
}
export interface UpdateObjectivePatch {
  title?: string; description?: string | null; period_label?: string | null;
  target_date?: string | null; status?: ObjectiveStatus; position?: number; archived?: boolean;
}

export async function listObjectives(deptId?: string): Promise<Objective[]> {
  let q = db().from("ceo_plan_objectives")
    .select("id, department_id, title, description, period_label, target_date, status, position")
    .is("archived_at", null).order("position").order("created_at");
  if (deptId) q = q.eq("department_id", deptId);
  const { data: objRows } = await q;
  const objs = (objRows ?? []) as Array<Record<string, unknown>>;
  if (objs.length === 0) return [];

  const ids = objs.map((o) => String(o.id));
  const [{ data: msRows }, deptNames, ownerNames] = await Promise.all([
    db().from("ceo_plan_milestones").select("id, objective_id, title, owner_id, due_date, done, position").in("objective_id", ids).order("position"),
    resolveDeptNames(objs.map((o) => o.department_id).filter((x): x is string => Boolean(x))),
    Promise.resolve(new Map<string, string>()),
  ]);
  const milestones = (msRows ?? []) as Array<Record<string, unknown>>;
  const ownerIds = [...new Set(milestones.map((m) => m.owner_id).filter((x): x is string => Boolean(x)))];
  if (ownerIds.length) {
    const { data: people } = await db().from("profiles").select("id, full_name, email").in("id", ownerIds);
    for (const p of (people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      ownerNames.set(p.id, p.full_name ?? p.email ?? "Member");
    }
  }

  const byObj = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const om = byObj.get(String(m.objective_id)) ?? [];
    om.push({
      id: String(m.id), objective_id: String(m.objective_id), title: String(m.title),
      owner_id: (m.owner_id as string) ?? null, owner_name: m.owner_id ? ownerNames.get(String(m.owner_id)) ?? null : null,
      due_date: (m.due_date as string) ?? null, done: Boolean(m.done), position: Number(m.position ?? 0),
    });
    byObj.set(String(m.objective_id), om);
  }

  return objs.map((o) => {
    const ms = byObj.get(String(o.id)) ?? [];
    const done = ms.filter((m) => m.done).length;
    const status = (o.status as ObjectiveStatus) ?? "on_track";
    const progress = status === "done" ? 100 : ms.length ? Math.round((done / ms.length) * 100) : 0;
    return {
      id: String(o.id), department_id: (o.department_id as string) ?? null,
      department_name: o.department_id ? deptNames.get(String(o.department_id)) ?? null : null,
      title: String(o.title), description: (o.description as string) ?? null,
      period_label: (o.period_label as string) ?? null, target_date: (o.target_date as string) ?? null,
      status, position: Number(o.position ?? 0), milestones: ms, progress,
    };
  });
}

async function resolveDeptNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(ids)];
  if (uniq.length) {
    const { data } = await db().from("departments").select("id, name").in("id", uniq);
    for (const d of (data ?? []) as Array<{ id: string; name: string }>) map.set(d.id, d.name);
  }
  return map;
}

export async function createObjective(input: CreateObjectiveInput, createdBy: string): Promise<string> {
  const { data, error } = await db().from("ceo_plan_objectives").insert({
    department_id: input.department_id ?? null, title: input.title,
    description: input.description ?? null, period_label: input.period_label ?? null,
    target_date: input.target_date ?? null, status: input.status ?? "on_track", created_by: createdBy,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function updateObjective(id: string, patch: UpdateObjectivePatch): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.period_label !== undefined) update.period_label = patch.period_label;
  if (patch.target_date !== undefined) update.target_date = patch.target_date;
  if (patch.status && STATUSES.has(patch.status)) update.status = patch.status;
  if (patch.position !== undefined) update.position = patch.position;
  if (patch.archived === true) update.archived_at = new Date().toISOString();
  const { error } = await db().from("ceo_plan_objectives").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createMilestone(objectiveId: string, input: { title: string; owner_id?: string | null; due_date?: string | null }): Promise<void> {
  const { error } = await db().from("ceo_plan_milestones").insert({
    objective_id: objectiveId, title: input.title, owner_id: input.owner_id ?? null, due_date: input.due_date ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateMilestone(id: string, patch: { done?: boolean; title?: string; owner_id?: string | null; due_date?: string | null }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.done !== undefined) { update.done = patch.done; update.done_at = patch.done ? new Date().toISOString() : null; }
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.owner_id !== undefined) update.owner_id = patch.owner_id;
  if (patch.due_date !== undefined) update.due_date = patch.due_date;
  if (Object.keys(update).length === 0) return;
  const { error } = await db().from("ceo_plan_milestones").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Compact list of objectives not on track (for the meeting board widget). */
export async function listAtRisk(): Promise<Array<{ id: string; title: string; department_name: string | null; status: ObjectiveStatus; progress: number }>> {
  const all = await listObjectives();
  return all.filter((o) => o.status === "at_risk" || o.status === "off_track")
    .map((o) => ({ id: o.id, title: o.title, department_name: o.department_name, status: o.status, progress: o.progress }));
}
