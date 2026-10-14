/** Sales tasks shown in the clock menu. Server only for the loader, the mapper is pure. */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ptWallToIso } from "@/lib/reminders/pt";
import type { Reminder, ReminderKind } from "@/lib/reminders/types";

export const SALES_ID_PREFIX = "sales:";

export type SalesTaskRow = {
  id: string; title: string; task_type: string | null; due_date: string | null;
  status: string | null; done_at: string | null; contact_name: string | null;
};

function kindFor(taskType: string | null): ReminderKind {
  const t = (taskType ?? "").toLowerCase();
  if (t === "call") return "call";
  if (t === "email" || t === "meeting" || t === "follow up" || t === "follow-up") return "follow_up";
  return "task";
}

/** Turns a Sales task into a clock row. Tasks with no due date can't be grouped, so they are skipped. */
export function salesTaskToReminder(row: SalesTaskRow): Reminder | null {
  const dueAt = row.due_date ? ptWallToIso(row.due_date.slice(0, 10), "09:00") : null;
  if (!dueAt) return null;
  return {
    id: `${SALES_ID_PREFIX}${row.id}`,
    title: row.title,
    kind: kindFor(row.task_type),
    due_at: dueAt,
    done_at: row.status === "done" ? (row.done_at ?? dueAt) : null,
    source: "sales",
    date_only: true,
    context: row.contact_name,
  };
}

/** The person's open Sales tasks, plus any they finished in the last 24 hours. */
export async function listSalesReminders(userId: string, sinceIso: string): Promise<Reminder[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const { data, error } = await db
    .from("sales_tasks")
    .select("id, title, task_type, due_date, status, done_at, contact_name")
    .eq("assignee_id", userId)
    .or(`status.eq.open,and(status.eq.done,done_at.gte.${sinceIso})`)
    .order("due_date", { ascending: true })
    .limit(100);
  if (error) return [];
  return ((data ?? []) as SalesTaskRow[]).map(salesTaskToReminder).filter((r): r is Reminder => r !== null);
}
