import { describe, expect, it } from "vitest";
import { groupByStage, groupTasksByOpportunity, type GroupOpp, type GroupTask } from "@/lib/sales/contact-task-groups";

const opps: GroupOpp[] = [
  { id: "o1", title: "SwiftSound seed round", stage_name: "Proposal", value_cents: 2500000, status: "open" },
  { id: "o2", title: "Techstars SPV", stage_name: "Meeting", value_cents: 8000000, status: "open" },
];
const t = (id: string, o: string | null, due: string | null, status = "open"): GroupTask => ({ id, title: id, task_type: "Call", due_date: due, status, assignee_name: null, opportunity_id: o });

describe("groupTasksByOpportunity", () => {
  const g = groupTasksByOpportunity(opps, [t("a", "o1", "2026-10-21"), t("b", "o1", "2026-10-12"), t("c", "o1", "2026-10-01", "done"), t("d", "o2", null), t("e", null, "2026-10-20")], "2026-10-15");
  it("sorts open tasks by due date and puts done last", () => {
    expect(g[0].tasks.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(g[0].next?.id).toBe("b");
  });
  it("counts open and overdue tasks", () => {
    expect(g[0].open).toBe(2);
    expect(g[0].overdue).toBe(1);
    expect(g[1].overdue).toBe(0);
  });
  it("adds a group for tasks with no opportunity", () => {
    expect(g[2].opp).toBeNull();
    expect(g[2].tasks.map((x) => x.id)).toEqual(["e"]);
  });
  it("keeps opportunities that have no tasks", () => {
    const only = groupTasksByOpportunity(opps, [], "2026-10-15");
    expect(only).toHaveLength(2);
    expect(only[0].next).toBeNull();
  });
});

describe("groupByStage", () => {
  it("orders stage columns by pipeline order", () => {
    const cols = groupByStage(groupTasksByOpportunity(opps, [], "2026-10-15"));
    expect(cols.map((c) => c.stage)).toEqual(["Meeting", "Proposal"]);
  });
});
