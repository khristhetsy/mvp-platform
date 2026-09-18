import { describe, expect, it } from "vitest";
import { attainment, countMetrics, goalTarget, periodFor, periodLabel, pipelineAsOf, previousPeriod, shiftPeriod, trailingPeriods, weekStart, type ActivityLite, type GoalLite, type MatchLite, type StageEventLite } from "./metrics";
import { INTRO_SUBJECT } from "./types";

const P = { start: "2026-09-14", end: "2026-09-21" };
const act = (o: Partial<ActivityLite>): ActivityLite => ({ id: "a", project_id: "p", match_id: "m1", type: "email", subject: "x", created_at: "2026-09-15T10:00:00Z", done_at: "2026-09-15T12:00:00Z", ...o });

describe("periods", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-09-17")).toBe("2026-09-14");   // Thursday → Monday
    expect(weekStart("2026-09-14")).toBe("2026-09-14");
    expect(weekStart("2026-09-20")).toBe("2026-09-14");   // Sunday stays in the same week
  });
  it("month periods and shifting", () => {
    expect(periodFor("month", "2026-09-17")).toEqual({ start: "2026-09-01", end: "2026-10-01" });
    expect(shiftPeriod("month", { start: "2026-01-01", end: "2026-02-01" }, -1)).toEqual({ start: "2025-12-01", end: "2026-01-01" });
    expect(trailingPeriods("week", "2026-09-17", 3).map((p) => p.start)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(previousPeriod({ start: "2026-09-10", end: "2026-09-20" })).toEqual({ start: "2026-08-31", end: "2026-09-10" });
    expect(periodLabel("week", P)).toBe("Sep 14 to Sep 20, 2026");
    expect(periodLabel("month", { start: "2026-09-01", end: "2026-10-01" })).toBe("September 2026");
  });
});

describe("countMetrics", () => {
  it("applies the spec definitions", () => {
    const acts: ActivityLite[] = [
      act({ id: "1", subject: INTRO_SUBJECT }),                                   // intro + email + contacted m1
      act({ id: "2", type: "call", match_id: "m2" }),                             // call + contacted m2
      act({ id: "3", type: "voicemail", match_id: "m2" }),                        // call
      act({ id: "4", type: "meeting", created_at: "2026-09-16T00:00:00Z", done_at: null }),   // booked only
      act({ id: "5", type: "meeting", created_at: "2026-09-01T00:00:00Z", done_at: "2026-09-18T00:00:00Z" }), // held only
      act({ id: "6", type: "email", done_at: "2026-09-22T00:00:00Z" }),           // outside
      act({ id: "7", type: "email", subject: "Founder report sent · Week 3", match_id: null }), // excluded
    ];
    const matches: MatchLite[] = [{ id: "m1", project_id: "p", stage: "committed", term_sheet_received_at: "2026-09-15T00:00:00Z" }, { id: "m2", project_id: "p", stage: "contacted", term_sheet_received_at: "2026-08-01T00:00:00Z" }];
    const events: StageEventLite[] = [{ match_id: "m1", to_stage: "committed", changed_at: "2026-09-19T00:00:00Z" }, { match_id: "m2", to_stage: "committed", changed_at: "2026-08-19T00:00:00Z" }];
    expect(countMetrics(acts, matches, events, P)).toEqual({ intros: 1, calls: 2, emails: 1, meetings_booked: 1, meetings_held: 1, term_sheets: 1, commitments: 1, contacted: 2 });
  });
});

describe("pipelineAsOf", () => {
  it("uses the latest event strictly before the cutoff", () => {
    const ev: StageEventLite[] = [
      { match_id: "a", to_stage: "matched", changed_at: "2026-09-01T00:00:00Z" },
      { match_id: "a", to_stage: "intro_sent", changed_at: "2026-09-10T00:00:00Z" },
      { match_id: "a", to_stage: "contacted", changed_at: "2026-09-21T00:00:00Z" },
      { match_id: "b", to_stage: "matched", changed_at: "2026-09-22T00:00:00Z" },
    ];
    const p = Object.fromEntries(pipelineAsOf(ev, "2026-09-21T00:00:00.000Z").map((r) => [r.stage, r.count]));
    expect(p.intro_sent).toBe(1); expect(p.contacted).toBe(0); expect(p.matched).toBe(0);
  });
});

describe("goals", () => {
  const goals: GoalLite[] = [
    { project_id: "p1", assignee_id: null, metric: "calls", period_kind: "week", period_start: "2026-09-14", target: 10 },
    { project_id: "p2", assignee_id: null, metric: "calls", period_kind: "week", period_start: "2026-09-14", target: 5 },
    { project_id: null, assignee_id: null, metric: "emails", period_kind: "week", period_start: "2026-09-14", target: 40 },
  ];
  it("firm-wide falls back to the sum of project goals", () => {
    expect(goalTarget(goals, { projectId: null, metric: "calls", kind: "week", start: "2026-09-14" })).toBe(15);
    expect(goalTarget(goals, { projectId: null, metric: "emails", kind: "week", start: "2026-09-14" })).toBe(40);
    expect(goalTarget(goals, { projectId: "p1", metric: "calls", kind: "week", start: "2026-09-14" })).toBe(10);
    expect(goalTarget(goals, { projectId: "p1", metric: "meetings_held", kind: "week", start: "2026-09-14" })).toBeNull();
  });
  it("never computes a percentage without a target", () => {
    expect(attainment(3, null)).toBeNull(); expect(attainment(3, 0)).toBeNull(); expect(attainment(3, 4)).toBe(0.75);
  });
});
