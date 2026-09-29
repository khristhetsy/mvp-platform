import { describe, expect, it } from "vitest";
import { activityBurndown } from "./burndown";

describe("activityBurndown", () => {
  const acts = [
    { created_at: "2026-09-01T10:00:00Z", done_at: "2026-09-10T10:00:00Z" },
    { created_at: "2026-09-02T10:00:00Z", done_at: null },
    { created_at: "2026-09-15T10:00:00Z", done_at: "2026-09-16T10:00:00Z" },
  ];
  it("counts to-dos open at each week end and stops at today", () => {
    const pts = activityBurndown(acts, "2026-09-01", "2026-10-01", new Date("2026-09-20T12:00:00Z"));
    expect(pts[0]).toMatchObject({ weekEnd: "2026-09-07", open: 2 });
    expect(pts[1]).toMatchObject({ weekEnd: "2026-09-14", open: 1 });
    expect(pts[2]).toMatchObject({ weekEnd: "2026-09-21", open: 1 });
    expect(pts[3].open).toBeNull();
  });
  it("ideal runs from the first week to zero at the end", () => {
    const pts = activityBurndown(acts, "2026-09-01", "2026-10-01", new Date("2026-09-20T12:00:00Z"));
    expect(pts[0].ideal).toBe(2);
    expect(pts[pts.length - 1].ideal).toBe(0);
  });
  it("returns nothing for an empty term", () => {
    expect(activityBurndown(acts, "2026-10-01", "2026-09-01")).toEqual([]);
  });
});
