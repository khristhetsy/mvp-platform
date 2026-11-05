// Task report metrics. Pure functions over normalized tasks, so they can be tested
// without a database. Target: src/lib/task-report/metrics.ts

export type ReportSource = "sales" | "ir" | "admin" | "general";

export const SOURCE_LABEL: Record<ReportSource, string> = { sales: "Sales", ir: "IR", general: "General", admin: "Admin" };

export type ReportTask = {
  id: string;
  source: ReportSource;
  title: string;
  type: string | null;
  due: string | null; // YYYY-MM-DD
  status: "open" | "done";
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  doneAt: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
};

export type PlanItemStats = { total: number; unlinked: number };

export type PersonRow = { name: string; total: number; open: number; overdue: number; done: number };
export type SourceRow = { source: ReportSource; label: string; total: number; open: number; overdue: number; done: number };
export type WeekRow = { weekStart: string; created: number; completed: number };
export type CreatorRow = { name: string; total: number; unassigned: number };
export type Improvement = { title: string; evidence: string; action: string; metric: string; metricLabel: string };

export type TaskSummary = {
  total: number; open: number; overdue: number; done: number; unassigned: number; unassignedOpen: number;
  people: PersonRow[];
  sources: SourceRow[];
  aging: { over30: number; under30: number; today: number; next7: number; later: number; openWithDate: number };
  weeks: WeekRow[];
  creators: CreatorRow[];
  efficiency: { ratio: number; byPerson: Array<PersonRow & { ratio: number }>; bySource: Array<SourceRow & { ratio: number }>; created8: number; completed8: number };
  improvements: Improvement[];
};

export const UNASSIGNED = "Unassigned";
const DAY = 86400000;

export function pct(n: number, d: number): number { return d > 0 ? (n / d) * 100 : 0; }
export function fmtPct(n: number, d: number): string {
  const v = pct(n, d);
  return `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`;
}
export function fmtPct1(n: number, d: number): string { return `${pct(n, d).toFixed(1)}%`; }

export function isOverdue(t: ReportTask, today: string): boolean {
  return t.status === "open" && !!t.due && t.due < today;
}

/** Monday of the week containing the given YYYY-MM-DD (UTC). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

function tally(list: ReportTask[], today: string) {
  let open = 0, overdue = 0, done = 0;
  for (const t of list) {
    if (t.status === "done") done++;
    else { open++; if (isOverdue(t, today)) overdue++; }
  }
  return { total: list.length, open, overdue, done };
}

export function summarize(tasks: ReportTask[], today: string, plan: PlanItemStats = { total: 0, unlinked: 0 }): TaskSummary {
  const all = tally(tasks, today);
  const unassignedList = tasks.filter((t) => !t.assigneeId);
  const unassigned = unassignedList.length;
  const unassignedOpen = unassignedList.filter((t) => t.status === "open").length;

  // People
  const byName = new Map<string, ReportTask[]>();
  for (const t of tasks) {
    const k = t.assigneeId ? (t.assigneeName ?? "Unknown") : UNASSIGNED;
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(t);
  }
  const people: PersonRow[] = [...byName.entries()]
    .map(([name, list]) => ({ name, ...tally(list, today) }))
    .sort((a, b) => b.open - a.open || b.total - a.total);

  // Sources
  const sources: SourceRow[] = (Object.keys(SOURCE_LABEL) as ReportSource[])
    .map((source) => ({ source, label: SOURCE_LABEL[source], ...tally(tasks.filter((t) => t.source === source), today) }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  // Aging of open tasks that have a due date
  const aging = { over30: 0, under30: 0, today: 0, next7: 0, later: 0, openWithDate: 0 };
  for (const t of tasks) {
    if (t.status !== "open") continue;
    if (!t.due) { aging.later++; aging.openWithDate++; continue; }
    aging.openWithDate++;
    const diff = daysBetween(today, t.due);
    if (diff < -29) aging.over30++;
    else if (diff < 0) aging.under30++;
    else if (diff === 0) aging.today++;
    else if (diff <= 7) aging.next7++;
    else aging.later++;
  }

  // Sales tasks created vs completed, last 8 weeks (Monday start)
  const sales = tasks.filter((t) => t.source === "sales");
  const thisWeek = weekStartOf(today);
  const weekStarts: string[] = [];
  for (let i = 7; i >= 0; i--) weekStarts.push(new Date(Date.parse(`${thisWeek}T00:00:00Z`) - i * 7 * DAY).toISOString().slice(0, 10));
  const weeks: WeekRow[] = weekStarts.map((weekStart) => ({ weekStart, created: 0, completed: 0 }));
  const idx = new Map(weeks.map((w, i) => [w.weekStart, i] as const));
  for (const t of sales) {
    const c = idx.get(weekStartOf(t.createdAt.slice(0, 10)));
    if (c !== undefined) weeks[c].created++;
    if (t.doneAt) {
      const d = idx.get(weekStartOf(t.doneAt.slice(0, 10)));
      if (d !== undefined) weeks[d].completed++;
    }
  }

  // Creators of sales tasks
  const creatorMap = new Map<string, CreatorRow>();
  for (const t of sales) {
    const k = t.createdById ? (t.createdByName ?? "Unknown") : "Not recorded";
    const row = creatorMap.get(k) ?? creatorMap.set(k, { name: k, total: 0, unassigned: 0 }).get(k)!;
    row.total++;
    if (!t.assigneeId) row.unassigned++;
  }
  const creators = [...creatorMap.values()].sort((a, b) => b.total - a.total);

  // Efficiency ratio: done tasks divided by all tasks.
  const created8 = weeks.reduce((n, w) => n + w.created, 0);
  const completed8 = weeks.reduce((n, w) => n + w.completed, 0);
  const efficiency = {
    ratio: pct(all.done, all.total),
    byPerson: people.map((p) => ({ ...p, ratio: pct(p.done, p.total) })),
    bySource: sources.map((s) => ({ ...s, ratio: pct(s.done, s.total) })),
    created8, completed8,
  };

  // Areas for improvement, every figure derived from the data above.
  const improvements: Improvement[] = [];
  if (all.overdue > 0) {
    improvements.push({
      title: "Overdue backlog",
      evidence: `${all.overdue} of ${all.open} open tasks are overdue. ${aging.over30} of the open tasks are overdue by 30 days or more.`,
      action: "Review and close or reschedule the 30 day plus group first.",
      metric: fmtPct(all.overdue, all.open), metricLabel: "of open tasks overdue",
    });
  }
  if (unassigned > 0) {
    const top = creators.filter((c) => c.unassigned > 0).sort((a, b) => b.unassigned - a.unassigned)[0];
    improvements.push({
      title: "Unassigned tasks",
      evidence: `${unassigned} tasks have no assignee, ${unassignedOpen} of them open.${top ? ` ${top.name} created ${top.unassigned} of the unassigned sales tasks.` : ""}`,
      action: "Require an assignee when a task is created.",
      metric: fmtPct(unassigned, all.total), metricLabel: "of all tasks unassigned",
    });
  }
  const last = weeks[weeks.length - 1];
  if (created8 > completed8 && last) {
    improvements.push({
      title: "Intake is outrunning completion",
      evidence: `Week of ${last.weekStart}: ${last.created} sales tasks created and ${last.completed} completed. Over the last 8 weeks: ${created8} created and ${completed8} completed.`,
      action: "Spread new tasks across the team and set a weekly completion target.",
      metric: fmtPct(last.completed, last.created), metricLabel: `completed vs created, week of ${last.weekStart}`,
    });
  }
  for (const s of sources) {
    if (s.source !== "sales" && s.total >= 5 && s.done === 0) {
      improvements.push({
        title: `${s.label} tasks not moving`,
        evidence: `${s.total} ${s.label} tasks, ${s.open} open, 0 done, ${s.overdue} overdue.`,
        action: "Assign an owner and review at the weekly meeting.",
        metric: "0%", metricLabel: `${s.label} completion`,
      });
    }
  }
  const named = people.filter((p) => p.name !== UNASSIGNED && p.open > 0).slice(0, 2);
  const slow = named.filter((p) => pct(p.done, p.total) < 10);
  if (slow.length > 0) {
    const worst = slow.reduce((a, b) => (pct(a.done, a.total) <= pct(b.done, b.total) ? a : b));
    improvements.push({
      title: slow.length === 2 ? "Two largest queues, almost no completions" : "Largest queue, almost no completions",
      evidence: slow.map((p) => `${p.name}: ${p.open} open, ${p.done} done.`).join(" "),
      action: "Review workload and due dates with each person.",
      metric: fmtPct1(worst.done, worst.total), metricLabel: `${worst.name}'s completion ratio`,
    });
  }
  if (plan.unlinked > 0) {
    improvements.push({
      title: "Marketing plan items without a task",
      evidence: `${plan.unlinked} of ${plan.total} marketing plan items have no linked task.`,
      action: "Create a task and owner for each item.",
      metric: fmtPct(plan.unlinked, plan.total), metricLabel: "of plan items have no task",
    });
  }

  return { ...all, unassigned, unassignedOpen, people, sources, aging, weeks, creators, efficiency, improvements };
}
