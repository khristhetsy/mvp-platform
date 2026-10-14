/** Groups a contact's Sales tasks by opportunity and by pipeline stage for the contact Tasks tab. Client safe. */

export type GroupTask = {
  id: string; title: string; task_type: string; due_date: string | null; status: string;
  assignee_name: string | null; opportunity_id?: string | null;
};
export type GroupOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; status: string };

export type OppTaskGroup = {
  /** Null for tasks that are not linked to any opportunity. */
  opp: GroupOpp | null;
  tasks: GroupTask[];
  open: number;
  overdue: number;
  /** Soonest due open task, undated after dated. */
  next: GroupTask | null;
};

/** Pipeline stage order used on the Sales board. Stages not listed go last, in the order they appear. */
export const STAGE_ORDER = ["New opportunity", "Qualified - Sent invitation", "Meeting", "Proposal", "Pending", "Negotiation", "Won", "Loss"];

const day = (d: string | null): string | null => (d ? d.slice(0, 10) : null);

function byDue(a: GroupTask, b: GroupTask): number {
  const da = day(a.due_date), db = day(b.due_date);
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return 0;
}

function build(opp: GroupOpp | null, all: GroupTask[], today: string): OppTaskGroup {
  const open = all.filter((t) => t.status !== "done").sort(byDue);
  const done = all.filter((t) => t.status === "done");
  return {
    opp,
    tasks: [...open, ...done],
    open: open.length,
    overdue: open.filter((t) => { const d = day(t.due_date); return d !== null && d < today; }).length,
    next: open[0] ?? null,
  };
}

/** One group per opportunity (in the order given, including ones with no tasks), then one for unlinked tasks. */
export function groupTasksByOpportunity(opps: GroupOpp[], tasks: GroupTask[], today: string): OppTaskGroup[] {
  const known = new Set(opps.map((o) => o.id));
  const groups = opps.map((o) => build(o, tasks.filter((t) => t.opportunity_id === o.id), today));
  const loose = tasks.filter((t) => !t.opportunity_id || !known.has(t.opportunity_id));
  if (loose.length > 0) groups.push(build(null, loose, today));
  return groups;
}

/** Opportunity groups placed in pipeline stage columns, only for stages this contact is in. */
export function groupByStage(groups: OppTaskGroup[]): Array<{ stage: string; groups: OppTaskGroup[] }> {
  const map = new Map<string, OppTaskGroup[]>();
  for (const g of groups) {
    if (!g.opp) continue;
    const stage = g.opp.stage_name ?? "No stage";
    map.set(stage, [...(map.get(stage) ?? []), g]);
  }
  const rank = (s: string) => { const i = STAGE_ORDER.indexOf(s); return i === -1 ? STAGE_ORDER.length : i; };
  return [...map.entries()].map(([stage, gs]) => ({ stage, groups: gs })).sort((a, b) => rank(a.stage) - rank(b.stage));
}
