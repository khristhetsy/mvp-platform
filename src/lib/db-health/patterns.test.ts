import { describe, expect, it } from "vitest";
import { expandField, findPatterns, jobsInHour } from "./patterns";
import type { IncidentRow, QueryStats } from "./load";

const inc = (iso: string, cause: IncidentRow["cause"] = "job_timeout"): IncidentRow => ({
  id: 1, started_at: iso, ended_at: null, peak_state: "warn", cause, peak_response_ms: null, peak_query_s: null, cron_timeouts: 0, action_taken: null,
});
const jobs = [
  { name: "Social maintenance", schedules: ["7 * * * *"] },
  { name: "Social publishing", schedules: ["1-59/5 * * * *"] },
  { name: "Orchestration", schedules: ["0 7 * * *", "0 19 * * *"] },
];

describe("expandField", () => {
  it("expands wildcards, steps, ranges and lists", () => {
    expect(expandField("*/20", 0, 59)).toEqual([0, 20, 40]);
    expect(expandField("1-59/15", 0, 59)).toEqual([1, 16, 31, 46]);
    expect(expandField("3,9", 0, 59)).toEqual([3, 9]);
    expect(expandField("2-4", 0, 23)).toEqual([2, 3, 4]);
    expect(expandField("7", 0, 59)).toEqual([7]);
    expect(expandField("x", 0, 59)).toEqual([]);
  });
});

describe("jobsInHour", () => {
  it("names jobs scheduled in the hour and skips ones that run all the time", () => {
    expect(jobsInHour(jobs, 7)).toEqual(["Social maintenance", "Orchestration"]);
    expect(jobsInHour(jobs, 12)).toEqual(["Social maintenance"]);
  });
});

describe("findPatterns", () => {
  it("shows nothing from incidents until there are 3", () => {
    const r = findPatterns({ incidents: [inc("2026-11-20T07:04:00Z"), inc("2026-11-21T07:09:00Z")], jobs, queryStats: null });
    expect(r.patterns).toEqual([]);
    expect(r).toMatchObject({ incidents: 2, needed: 3 });
  });
  it("finds an hour of day and a repeated cause, with counted percentages", () => {
    const r = findPatterns({
      incidents: [inc("2026-11-20T07:04:00Z"), inc("2026-11-21T07:09:00Z"), inc("2026-11-22T19:01:00Z", "slow_query")],
      jobs, queryStats: null,
    });
    const hour = r.patterns.find((p) => p.key === "hour")!;
    expect(hour.title).toBe("Slowdowns cluster around 07:00 UTC");
    expect(hour.detail).toContain("2 of 3 incidents (67%)");
    expect(hour.detail).toContain("Social maintenance, Orchestration");
    expect(r.patterns.find((p) => p.key === "cause")!.detail).toBe("2 of 3 incidents (67%).");
  });
  it("flags queries above normal without needing incidents", () => {
    const qs: QueryStats = { norms: { queries: 100, median_mean_ms: 2.3, p90_mean_ms: 47.2 }, top: [
      { q: "SELECT wal->>$5 FROM x", calls: 9, mean_ms: 8, max_ms: 14000, time_pct: 39.7, call_pct: 21 },
      { q: "SELECT 1 FROM crm_contacts WHERE email_status = $1", calls: 5, mean_ms: 732, max_ms: 8000, time_pct: 3.8, call_pct: 0.02 },
    ] };
    const r = findPatterns({ incidents: [], jobs, queryStats: qs });
    expect(r.patterns).toHaveLength(1);
    expect(r.patterns[0]!.title).toBe("1 of the 2 most time consuming queries are above normal");
    expect(r.patterns[0]!.detail).toContain("Contact search by email status: 732 ms average, 15.5x the normal limit of 47.2 ms");
  });
});
