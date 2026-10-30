import { describe, expect, it } from "vitest";
import { DEFAULT_HEALTH_SETTINGS as D } from "./evaluate";
import { buildTiles, fmtMs } from "./tiles";
import type { SampleRow } from "./load";

const now = Date.parse("2026-11-20T12:00:00Z");
const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
const sample = (minsAgo: number, over: Partial<SampleRow> = {}): SampleRow => ({
  taken_at: at(minsAgo), response_ms: 300, active_connections: 20, longest_query_s: 1, cron_timeouts: 0, state: "ok", ...over,
});
/** Eight days of 5 minute readings with a little variation, newest last. */
const history = (latest: Partial<SampleRow> = {}): SampleRow[] =>
  Array.from({ length: 8 * 288 }, (_, i) => {
    const minsAgo = (8 * 288 - 1 - i) * 5;
    return sample(minsAgo, i % 2 ? { response_ms: 250 } : { response_ms: 350 });
  }).map((s, i, a) => (i === a.length - 1 ? { ...s, ...latest } : s));

describe("fmtMs", () => {
  it("shows milliseconds under a second, then seconds", () => {
    expect(fmtMs(250)).toBe("250 ms");
    expect(fmtMs(7400)).toBe("7.4 s");
    expect(fmtMs(48_000)).toBe("48 s");
  });
});

describe("buildTiles", () => {
  it("returns null when nothing has been measured", () => {
    expect(buildTiles({ now, settings: D, samples: [], jobs: [] })).toBeNull();
  });

  it("flags an overloaded response against the limit and the 7 day average", () => {
    const tiles = buildTiles({ now, settings: D, samples: history({ response_ms: 7400, state: "overload" }), jobs: [] })!;
    const t = tiles[0]!;
    expect(t.value).toBe("7.4 s");
    expect(t.ring.percent).toBe(100);
    expect(t.ring.center).toBe("148%");
    expect(t.flag).toEqual({ text: "Over the 5 s overload limit", tone: "bad" });
    expect(t.detail).toContain("Above normal");
    expect(t.detailPanel.breakdown?.find((r) => r.label === "Should be")?.value).toBe("Under 2 s");
    expect(t.detailPanel.chart?.limits?.map((l) => l.value)).toEqual([2, 5]);
  });

  it("says it is building a baseline until 7 days of readings exist", () => {
    const short = Array.from({ length: 50 }, (_, i) => sample((49 - i) * 5));
    const t = buildTiles({ now, settings: D, samples: short, jobs: [] })![0]!;
    expect(t.detail).toContain("Building a baseline, 0 of 7 days");
    expect(t.detailPanel.chart?.band).toBeUndefined();
  });

  it("reports a failed test query instead of a number", () => {
    const t = buildTiles({ now, settings: D, samples: history({ response_ms: null, state: "overload" }), jobs: [] })![0]!;
    expect(t.value).toBe("Failed");
    expect(t.flag?.tone).toBe("bad");
    expect(t.ring.pending).toBe(true);
  });

  it("measures the longest query against the query limit", () => {
    const t = buildTiles({ now, settings: D, samples: history({ longest_query_s: 48, state: "warn" }), jobs: [] })![1]!;
    expect(t.value).toBe("48 s");
    expect(t.ring.center).toBe("160%");
    expect(t.flag?.tone).toBe("bad");
  });

  it("has no connection scale because the plan limit is not read", () => {
    const t = buildTiles({ now, settings: D, samples: history(), jobs: [] })![2]!;
    expect(t.ring.pending).toBe(true);
    expect(t.flag).toBeNull();
  });

  it("counts job timeouts from the run log", () => {
    const jobs = [
      { path: "/api/cron/social-maintenance", name: "Social maintenance", runs: 24, timeouts: 1 },
      { path: "/api/cron/social-queue", name: "Social publishing", runs: 288, timeouts: 1 },
      { path: "/api/cron/matching", name: "Matching pass", runs: 100, timeouts: 0 },
    ];
    const t = buildTiles({ now, settings: D, samples: history(), jobs })![3]!;
    expect(t.value).toBe("2");
    expect(t.unit).toBe("of 412 runs");
    expect(t.flag?.text).toBe("2 jobs did not finish");
    expect(t.detail).toContain("Social maintenance, Social publishing");
    expect(t.detailPanel.href).toBe("/admin/scheduled-jobs");
  });
});
