/**
 * Next pending task for each deal on the Sales pipeline board: the soonest due open
 * sales task linked to the opportunity (sales_tasks.opportunity_id), how many other open
 * tasks it has, and whether it's overdue, due today or planned (dates in PT, the platform
 * time zone). One query per 200 deals; never throws (the board just shows no task line).
 * Odoo activities are not read here, so the board never waits on Odoo.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export type PendingTask = {
  type: string;
  title: string;
  /** YYYY-MM-DD or null */
  due: string | null;
  state: "overdue" | "today" | "planned";
  /** Other open tasks on the same deal. */
  more: number;
};

type Row = { opportunity_id: string; task_type: string | null; title: string | null; due_date: string | null; created_at: string };

export function platformToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Pure: pick the soonest due open task per deal (undated after dated, then oldest first). Exported for tests. */
export function pickPendingTasks(rows: Row[], today: string): Record<string, PendingTask> {
  const byOpp = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.opportunity_id) continue;
    byOpp.set(r.opportunity_id, [...(byOpp.get(r.opportunity_id) ?? []), r]);
  }
  const out: Record<string, PendingTask> = {};
  for (const [id, list] of byOpp) {
    const next = [...list].sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    })[0];
    const due = next.due_date ? next.due_date.slice(0, 10) : null;
    out[id] = {
      type: next.task_type ?? "Task", title: next.title ?? "", due,
      state: !due ? "planned" : due < today ? "overdue" : due === today ? "today" : "planned",
      more: list.length - 1,
    };
  }
  return out;
}

export async function loadPendingTasks(oppIds: string[]): Promise<Record<string, PendingTask>> {
  if (oppIds.length === 0) return {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sales_* tables are not in the generated types
    const db: any = createServiceRoleClient();
    const rows: Row[] = [];
    for (let i = 0; i < oppIds.length; i += 200) {
      const part = oppIds.slice(i, i + 200);
      const { data, error } = await db.from("sales_tasks")
        .select("opportunity_id, task_type, title, due_date, created_at")
        .in("opportunity_id", part)
        .eq("status", "open")
        .limit(part.length * 50);
      if (error) return {};
      rows.push(...((data ?? []) as Row[]));
    }
    return pickPendingTasks(rows, platformToday());
  } catch {
    return {};
  }
}
