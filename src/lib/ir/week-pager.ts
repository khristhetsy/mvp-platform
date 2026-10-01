/**
 * Week pager for the matching queue: the same order and wrap-around as the task
 * page pager (TaskFormClient), plus the queue URL that carries the view over to
 * the next week (tab, group by, open groups). Pure.
 */

export type WeekTask = { id: string; title: string; milestone_id: string };
export type WeekRank = { id: string; sort_order: number };

/** A project's weekly tasks in week order (ties keep their given order). */
export function orderWeeklyTasks<T extends WeekTask>(siblings: readonly T[], weeks: readonly WeekRank[]): T[] {
  const rank = new Map(weeks.map((w) => [w.id, w.sort_order]));
  return siblings
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (rank.get(a.t.milestone_id) ?? 0) - (rank.get(b.t.milestone_id) ?? 0) || a.i - b.i)
    .map((x) => x.t);
}

/** Position of the current task and its wrap-around neighbours (Odoo record pager). */
export function weekNeighbours<T extends { id: string }>(ordered: readonly T[], currentId: string): { index: number; total: number; prev: T | null; next: T | null } {
  const n = ordered.length;
  const index = ordered.findIndex((t) => t.id === currentId);
  if (index < 0 || n < 2) return { index, total: n, prev: null, next: null };
  return { index, total: n, prev: ordered[(index - 1 + n) % n], next: ordered[(index + 1) % n] };
}

/** What carries over to the next week's queue. Filters are not carried: they reset to the founder's defaults. */
export type QueueView = { mode: "match" | "search"; groupBy: string | null; open: string[] };

export function matchingQueueHref(projectId: string, taskId: string, view: QueueView): string {
  const q = new URLSearchParams();
  if (view.mode === "search") q.set("mode", "search");
  if (view.groupBy) q.set("group", view.groupBy);
  if (view.groupBy && view.open.length) q.set("open", view.open.join("|"));
  const s = q.toString();
  return `/admin/ir/projects/${projectId}/tasks/${taskId}/matching${s ? `?${s}` : ""}`;
}

/** Reads the carried view back from the queue URL. */
export function readQueueView(p: { mode?: string; group?: string; open?: string }): QueueView {
  const groupBy = p.group?.trim() || null;
  return {
    mode: p.mode === "search" ? "search" : "match",
    groupBy,
    open: groupBy && p.open ? p.open.split("|").map((s) => s.trim()).filter(Boolean) : [],
  };
}
