// Loads every task from the four internal task tables as one normalized list.
// Target: src/lib/task-report/queries.ts
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PlanItemStats, ReportTask } from "./metrics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const day = (v: unknown): string | null => { const x = s(v); return x ? x.slice(0, 10) : null; };
const DONE = new Set(["done", "completed", "complete"]);

async function rows(table: string, select: string, archivedFilter: boolean): Promise<Row[]> {
  let q = db().from(table).select(select).range(0, 4999);
  if (archivedFilter) q = q.is("archived_at", null);
  const { data } = await q;
  return (data ?? []) as Row[];
}

export async function loadReportTasks(): Promise<ReportTask[]> {
  const [sales, ir, admin, general] = await Promise.all([
    rows("sales_tasks", "id, title, task_type, due_date, status, assignee_id, created_by, created_at, done_at, contact_crm_id, contact_name, opportunity_id", false),
    rows("ir_tasks", "id, title, status, assignee_id, deadline, created_at", true),
    rows("admin_tasks", "id, title, status, assignee_id, due_date, created_by, created_at", true),
    rows("tasks", "id, title, status, assigned_to, created_by, due_date, task_type, task_category, created_at", false),
  ]);

  const out: ReportTask[] = [];
  const base = (r: Row, source: ReportTask["source"]): ReportTask => ({
    id: String(r.id), source, title: s(r.title) ?? "Untitled", type: null, due: null,
    status: DONE.has(String(r.status ?? "").toLowerCase()) ? "done" : "open",
    assigneeId: null, assigneeName: null, createdById: null, createdByName: null,
    createdAt: s(r.created_at) ?? new Date(0).toISOString(), doneAt: null,
    contactId: null, contactName: null, opportunityId: null,
  });

  for (const r of sales) out.push({ ...base(r, "sales"), type: s(r.task_type), due: day(r.due_date), assigneeId: s(r.assignee_id), createdById: s(r.created_by), doneAt: s(r.done_at), contactId: s(r.contact_crm_id), contactName: s(r.contact_name), opportunityId: s(r.opportunity_id) });
  for (const r of ir) out.push({ ...base(r, "ir"), due: day(r.deadline), assigneeId: s(r.assignee_id) });
  for (const r of admin) out.push({ ...base(r, "admin"), due: day(r.due_date), assigneeId: s(r.assignee_id), createdById: s(r.created_by) });
  for (const r of general) out.push({ ...base(r, "general"), type: s(r.task_type) ?? s(r.task_category), due: day(r.due_date), assigneeId: s(r.assigned_to), createdById: s(r.created_by) });

  // Resolve names for assignees and creators in one query.
  const ids = [...new Set(out.flatMap((t) => [t.assigneeId, t.createdById]).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await db().from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name ?? p.email ?? "Unknown");
  }
  for (const t of out) {
    t.assigneeName = t.assigneeId ? (names.get(t.assigneeId) ?? "Unknown") : null;
    t.createdByName = t.createdById ? (names.get(t.createdById) ?? "Unknown") : null;
  }
  return out;
}

export async function loadPlanItemStats(): Promise<PlanItemStats> {
  try {
    const [{ count: total }, { count: unlinked }] = await Promise.all([
      db().from("marketing_plan_items").select("id", { count: "exact", head: true }),
      db().from("marketing_plan_items").select("id", { count: "exact", head: true }).is("task_id", null),
    ]);
    return { total: total ?? 0, unlinked: unlinked ?? 0 };
  } catch {
    return { total: 0, unlinked: 0 };
  }
}

/** Where "Open to view" goes for a task. Sales tasks go to the contact's account. */
export function taskHref(t: ReportTask): string {
  if (t.source === "sales") {
    if (t.contactId) return `/admin/sales/contacts/${t.contactId}?tab=tasks`;
    if (t.opportunityId) return `/admin/sales/opportunities/${t.opportunityId}`;
    return "/admin/sales/tasks";
  }
  if (t.source === "ir") return "/admin/ir/tasks";
  return "/admin/tasks";
}
