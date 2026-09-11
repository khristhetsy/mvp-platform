import { describe, it, expect } from "vitest";
import {
  periodStart, nextPeriodStart, prevPeriodStart, periodElapsed, periodKey,
  computeFunnel, blendedPct, pacing, aggregateFunnels,
  type StageCounts, type CampaignFunnel,
} from "./funnel";

describe("period math", () => {
  it("week starts on Monday (UTC)", () => {
    // 2026-09-11 is a Friday → week start Monday 2026-09-07
    expect(periodKey(periodStart("week", new Date("2026-09-11T12:00:00Z")))).toBe("2026-09-07");
  });
  it("month/quarter/year starts", () => {
    const d = new Date("2026-09-11T12:00:00Z");
    expect(periodKey(periodStart("month", d))).toBe("2026-09-01");
    expect(periodKey(periodStart("quarter", d))).toBe("2026-07-01"); // Q3
    expect(periodKey(periodStart("year", d))).toBe("2026-01-01");
  });
  it("next/prev period stepping", () => {
    const m = periodStart("month", new Date("2026-09-11T00:00:00Z"));
    expect(periodKey(nextPeriodStart("month", m))).toBe("2026-10-01");
    expect(periodKey(prevPeriodStart("month", m))).toBe("2026-08-01");
    const q = periodStart("quarter", new Date("2026-09-11T00:00:00Z"));
    expect(periodKey(prevPeriodStart("quarter", q))).toBe("2026-04-01");
    const w = periodStart("week", new Date("2026-09-11T00:00:00Z"));
    expect(periodKey(nextPeriodStart("week", w))).toBe("2026-09-14");
  });
  it("elapsed fraction is within [0,1]", () => {
    const start = periodStart("month", new Date("2026-09-11T00:00:00Z"));
    const e = periodElapsed("month", start, new Date("2026-09-16T00:00:00Z")); // day 15/30
    expect(e).toBeGreaterThan(0.4);
    expect(e).toBeLessThan(0.6);
  });
});

const counts = (o: number, c: number, m: number, cv: number): StageCounts => ({ outreach: o, clicks: c, meetings: m, conversions: cv });

describe("computeFunnel", () => {
  const cur = counts(124, 5180, 248, 142);
  const prev = counts(110, 4796, 256, 149);
  const goals = { outreach: 160, clicks: 6000, meetings: 320, conversions: 200 };
  const res = computeFunnel(cur, prev, goals);

  it("computes % of goal per stage", () => {
    expect(res.find((s) => s.stage === "outreach")!.pctOfGoal).toBe(77.5);
    expect(res.find((s) => s.stage === "clicks")!.pctOfGoal).toBeCloseTo(86.3, 1);
    expect(res.find((s) => s.stage === "conversions")!.pctOfGoal).toBe(71);
  });
  it("has no impressions stage", () => {
    expect(res.find((s) => (s.stage as string) === "impressions")).toBeUndefined();
    expect(res).toHaveLength(4);
  });
  it("returns null % when no target", () => {
    const r = computeFunnel(cur, prev, { conversions: null });
    expect(r.find((s) => s.stage === "outreach")!.pctOfGoal).toBeNull();
  });
  it("computes vs-previous delta and its sign", () => {
    expect(res.find((s) => s.stage === "outreach")!.deltaPct).toBeGreaterThan(0);   // 124 vs 110 ↑
    expect(res.find((s) => s.stage === "conversions")!.deltaPct).toBeLessThan(0);   // 142 vs 149 ↓
  });
  it("null delta when previous is zero", () => {
    const r = computeFunnel(cur, counts(0, 0, 0, 0), goals);
    expect(r[0].deltaPct).toBeNull();
  });
  it("step ratio: CTR = clicks / outreach is the first step", () => {
    const ctr = res.find((s) => s.stage === "clicks")!.stepFromPrevRatio!; // 5180/124
    expect(ctr).toBeGreaterThan(0);
    expect(res.find((s) => s.stage === "outreach")!.stepFromPrevRatio).toBeNull();
  });
});

describe("blendedPct + pacing", () => {
  const stages = computeFunnel(
    counts(124, 5180, 248, 142),
    counts(0, 0, 0, 0),
    { outreach: 160, clicks: 6000, meetings: 320, conversions: 200 },
  );
  it("blends only stages with a goal", () => {
    const b = blendedPct(stages)!;
    expect(b).toBeGreaterThan(70);
    expect(b).toBeLessThan(90);
    expect(blendedPct(computeFunnel(counts(1, 1, 1, 1), counts(0, 0, 0, 0), {}))).toBeNull();
  });
  it("pacing verdicts against elapsed (target = elapsed×100, ±8 band)", () => {
    expect(pacing(79, 0.63)).toBe("ahead");    // 79 ≥ 63+8
    expect(pacing(65, 0.63)).toBe("on_track"); // within 63 ± 8
    expect(pacing(50, 0.63)).toBe("behind");   // 50 < 63−8
    expect(pacing(null, 0.5)).toBeNull();
  });
});

describe("aggregateFunnels", () => {
  const mk = (name: string, o: number, cv: number, goalO: number | null): CampaignFunnel => ({
    campaignId: name, name, sourceTag: name, grain: "month", periodStart: "2026-09-01",
    stages: computeFunnel(counts(o, o * 40, o * 2, cv), counts(0, 0, 0, 0), { outreach: goalO, conversions: 100 }),
    members: 0, revenueCents: 0,
  });
  it("sums actuals and targets across campaigns", () => {
    const agg = aggregateFunnels([mk("a", 10, 5, 20), mk("b", 20, 8, 30)]);
    expect(agg.find((s) => s.stage === "outreach")!.actual).toBe(30);
    expect(agg.find((s) => s.stage === "outreach")!.target).toBe(50);   // 20 + 30
    expect(agg.find((s) => s.stage === "conversions")!.actual).toBe(13); // 5 + 8
    expect(agg.find((s) => s.stage === "conversions")!.target).toBe(200); // 100 + 100
  });
  it("target is null when no campaign set one for a stage", () => {
    const agg = aggregateFunnels([mk("a", 10, 5, null)]);
    expect(agg.find((s) => s.stage === "outreach")!.target).toBeNull();
  });
});
