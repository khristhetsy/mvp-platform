// Next task queue. Target: src/lib/task-report/next-task.ts
// The Task report saves its visible open tasks (in the order shown) when "Open to view" is clicked.
// The contact Tasks tab reads that list to offer a "Next task" button. Pure helpers, no React.

export type QueueItem = { id: string; href: string; type: string | null; contactName: string | null; due: string | null };
type RowLike = { id: string; href: string; status: "open" | "done"; type: string | null; contactName: string | null; due: string | null };

export const NEXT_TASK_KEY = "icapos.taskReport.queue";

const pathOf = (href: string) => href.split("?")[0];

/** Open tasks that live on a contact page, in the order given, one entry per contact. */
export function buildQueue(rows: RowLike[]): QueueItem[] {
  const seen = new Set<string>();
  const out: QueueItem[] = [];
  for (const r of rows) {
    if (r.status !== "open" || !r.href.startsWith("/admin/sales/contacts/")) continue;
    const p = pathOf(r.href);
    if (seen.has(p)) continue;
    seen.add(p);
    out.push({ id: r.id, href: r.href, type: r.type, contactName: r.contactName, due: r.due });
  }
  return out;
}

/** The queue entry for the contact after the one on screen, or null when this is the last (or not in the queue). */
export function nextInQueue(queue: QueueItem[], currentPath: string): QueueItem | null {
  const at = queue.findIndex((q) => pathOf(q.href) === pathOf(currentPath));
  if (at < 0) return null;
  return queue[at + 1] ?? null;
}

export function dueText(due: string | null, today: string): { text: string; overdue: boolean } {
  if (!due) return { text: "No date", overdue: false };
  if (due < today) return { text: `${Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000)}d overdue`, overdue: true };
  if (due === today) return { text: "Today", overdue: false };
  return { text: due, overdue: false };
}

export function saveQueue(queue: QueueItem[]) {
  try { sessionStorage.setItem(NEXT_TASK_KEY, JSON.stringify(queue)); } catch { /* storage unavailable: the button simply does not show */ }
}

export function readQueueRaw(): string | null {
  try { return sessionStorage.getItem(NEXT_TASK_KEY); } catch { return null; }
}

export function parseQueue(raw: string | null): QueueItem[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((q) => q && typeof q.href === "string") : [];
  } catch { return []; }
}
