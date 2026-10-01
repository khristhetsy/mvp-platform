import { describe, expect, it } from "vitest";
import { matchingQueueHref, orderWeeklyTasks, readQueueView, weekNeighbours } from "./week-pager";

const weeks = [{ id: "w1", sort_order: 1 }, { id: "w2", sort_order: 2 }, { id: "w14", sort_order: 14 }];
const tasks = [
  { id: "t14", title: "Week 14", milestone_id: "w14" },
  { id: "t1", title: "1st Week", milestone_id: "w1" },
  { id: "t2", title: "2nd Week", milestone_id: "w2" },
];

describe("week pager", () => {
  it("orders tasks by week, like the task page", () => {
    expect(orderWeeklyTasks(tasks, weeks).map((t) => t.id)).toEqual(["t1", "t2", "t14"]);
  });
  it("wraps from the last week to the first and back", () => {
    const o = orderWeeklyTasks(tasks, weeks);
    expect(weekNeighbours(o, "t14")).toMatchObject({ index: 2, total: 3, prev: { id: "t2" }, next: { id: "t1" } });
    expect(weekNeighbours(o, "t1")).toMatchObject({ index: 0, prev: { id: "t14" }, next: { id: "t2" } });
  });
  it("has no neighbours with one task or an unknown id", () => {
    expect(weekNeighbours([tasks[0]], "t14")).toMatchObject({ prev: null, next: null });
    expect(weekNeighbours(tasks, "nope")).toMatchObject({ index: -1, prev: null, next: null });
  });
  it("carries the tab, group by and open groups in the URL, and reads them back", () => {
    const href = matchingQueueHref("p1", "t2", { mode: "search", groupBy: "industry", open: ["Software", "Health & Care"] });
    expect(href).toBe("/admin/ir/projects/p1/tasks/t2/matching?mode=search&group=industry&open=Software%7CHealth+%26+Care");
    const q = new URL(href, "https://icapos.com").searchParams;
    expect(readQueueView({ mode: q.get("mode") ?? undefined, group: q.get("group") ?? undefined, open: q.get("open") ?? undefined }))
      .toEqual({ mode: "search", groupBy: "industry", open: ["Software", "Health & Care"] });
  });
  it("leaves the URL clean with no group by", () => {
    expect(matchingQueueHref("p1", "t2", { mode: "match", groupBy: null, open: ["x"] })).toBe("/admin/ir/projects/p1/tasks/t2/matching");
    expect(readQueueView({})).toEqual({ mode: "match", groupBy: null, open: [] });
  });
});
