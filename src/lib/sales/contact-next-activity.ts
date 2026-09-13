/**
 * "Activities" column for the Contacts list — one line per contact, Odoo-style:
 * the next OPEN task (soonest due first), or the most recently completed one when
 * nothing is open. One bulk query per page of contacts; never throws.
 */
export type NextActivity = {
  /** e.g. "Call", "Follow-up" */
  type: string;
  title: string;
  /** YYYY-MM-DD or null */
  due: string | null;
  state: "overdue" | "today" | "planned" | "done" | "none";
};

type TaskRow = { contact_crm_id: string; task_type: string | null; title: string | null; due_date: string | null; status: string; done_at: string | null; created_at: string };

export function classify(due: string | null, today: string): NextActivity["state"] {
  if (!due) return "planned";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "planned";
}

/** Pure: pick the one line to show for each contact from its tasks. Exported for tests. */
export function pickNextActivity(rows: TaskRow[], today: string): Map<string, NextActivity> {
  const open = new Map<string, TaskRow>();
  const done = new Map<string, TaskRow>();
  for (const r of rows) {
    if (!r.contact_crm_id) continue;
    if (r.status === "done") {
      const cur = done.get(r.contact_crm_id);
      if (!cur || (r.done_at ?? r.created_at) > (cur.done_at ?? cur.created_at)) done.set(r.contact_crm_id, r);
      continue;
    }
    const cur = open.get(r.contact_crm_id);
    // Soonest due wins; undated tasks sort after dated ones.
    const better = !cur || (r.due_date && (!cur.due_date || r.due_date < cur.due_date));
    if (better) open.set(r.contact_crm_id, r);
  }
  const out = new Map<string, NextActivity>();
  for (const [id, r] of open) out.set(id, { type: r.task_type ?? "Task", title: r.title ?? "", due: r.due_date, state: classify(r.due_date, today) });
  for (const [id, r] of done) if (!out.has(id)) out.set(id, { type: r.task_type ?? "Task", title: r.title ?? "", due: r.due_date, state: "done" });
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadNextActivities(db: any, contactIds: string[]): Promise<Map<string, NextActivity>> {
  if (contactIds.length === 0) return new Map();
  try {
    const { data } = await db.from("sales_tasks")
      .select("contact_crm_id, task_type, title, due_date, status, done_at, created_at")
      .in("contact_crm_id", contactIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(contactIds.length * 20);
    return pickNextActivity((data ?? []) as TaskRow[], new Date().toISOString().slice(0, 10));
  } catch {
    return new Map();
  }
}
