// Weekly Meeting System — conference checklists (spec §2.5).
// Applying a checklist template to a conference bulk-inserts ceo_meeting_tasks
// (source='checklist', linked_event_id=conference, due=event_date+offset_days). The
// checklist UI then reads/writes those tasks; progress = done / total.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface ChecklistTemplate { id: string; name: string; event_kind: string; item_count: number }
export interface ChecklistTask {
  id: string; title: string; phase: string | null; due_date: string | null;
  status: string; department_name: string | null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const { data: tmpls } = await db().from("ceo_checklist_templates").select("id, name, event_kind").order("name");
  const rows = (tmpls ?? []) as Array<{ id: string; name: string; event_kind: string }>;
  if (rows.length === 0) return [];
  const { data: items } = await db().from("ceo_checklist_template_items").select("template_id").in("template_id", rows.map((r) => r.id));
  const counts = new Map<string, number>();
  for (const it of (items ?? []) as Array<{ template_id: string }>) counts.set(it.template_id, (counts.get(it.template_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, item_count: counts.get(r.id) ?? 0 }));
}

/** Apply a template to a conference: bulk-insert dated checklist tasks. Idempotent-ish:
 *  skips if the conference already has checklist tasks. */
export async function applyChecklist(conferenceId: string, templateId: string): Promise<{ created: number }> {
  const { data: conf } = await db().from("ceo_conferences").select("id, start_date").eq("id", conferenceId).maybeSingle();
  if (!conf) throw new Error("Conference not found.");

  const { data: existing } = await db().from("ceo_meeting_tasks")
    .select("id").eq("linked_event_id", conferenceId).eq("source", "checklist").limit(1);
  if ((existing ?? []).length > 0) return { created: 0 };

  const { data: items } = await db().from("ceo_checklist_template_items")
    .select("phase, offset_days, title, department_id, position").eq("template_id", templateId).order("position");
  const rows = ((items ?? []) as Array<{ phase: string; offset_days: number; title: string; department_id: string | null }>).map((it) => ({
    title: it.title,
    department_id: it.department_id ?? null,
    due_date: addDays(String(conf.start_date), it.offset_days),
    source: "checklist",
    linked_event_id: conferenceId,
    priority: "high",
    status: "not_started",
    agent_note: it.phase,   // stash the phase tag for grouping in the UI
  }));
  if (rows.length === 0) return { created: 0 };
  const { error } = await db().from("ceo_meeting_tasks").insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}

export async function listConferenceChecklist(conferenceId: string): Promise<{ tasks: ChecklistTask[]; done: number; total: number }> {
  const { data } = await db().from("ceo_meeting_tasks")
    .select("id, title, due_date, status, department_id, agent_note")
    .eq("linked_event_id", conferenceId).eq("source", "checklist").order("due_date");
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter((x): x is string => Boolean(x)))];
  const deptNames = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db().from("departments").select("id, name").in("id", deptIds);
    for (const d of (depts ?? []) as Array<{ id: string; name: string }>) deptNames.set(d.id, d.name);
  }
  const tasks: ChecklistTask[] = rows.map((r) => ({
    id: String(r.id), title: String(r.title), phase: (r.agent_note as string) ?? null,
    due_date: (r.due_date as string) ?? null, status: String(r.status),
    department_name: r.department_id ? deptNames.get(String(r.department_id)) ?? null : null,
  }));
  const done = tasks.filter((t) => t.status === "done").length;
  return { tasks, done, total: tasks.length };
}
