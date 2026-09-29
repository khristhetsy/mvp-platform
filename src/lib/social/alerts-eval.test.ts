import { describe, it, expect } from "vitest";
import { shouldFire, alertMessage, type MetricSnapshot } from "./alerts-eval";
import type { AlertRule } from "./goals-io";

const snap = (deltaPct: number | null, paceRatioPct: number | null): MetricSnapshot => ({ deltaPct, paceRatioPct });

describe("shouldFire", () => {
  it("up: fires when delta ≥ threshold", () => {
    expect(shouldFire("up", 25, snap(30, null))).toBe(true);
    expect(shouldFire("up", 25, snap(20, null))).toBe(false);
    expect(shouldFire("up", 25, snap(null, null))).toBe(false);
  });
  it("down: fires when delta ≤ −threshold", () => {
    expect(shouldFire("down", 10, snap(-12, null))).toBe(true);
    expect(shouldFire("down", 10, snap(-5, null))).toBe(false);
    expect(shouldFire("down", 10, snap(5, null))).toBe(false);
  });
  it("behind_pace: fires when attainment below threshold% of pace", () => {
    expect(shouldFire("behind_pace", 90, snap(null, 80))).toBe(true);   // 80% of pace < 90
    expect(shouldFire("behind_pace", 90, snap(null, 95))).toBe(false);  // ahead of the 90 floor
    expect(shouldFire("behind_pace", 90, snap(null, null))).toBe(false);
  });
});

describe("alertMessage", () => {
  const base: AlertRule = { id: "r1", metric: "conversions", direction: "down", threshold_pct: 10, grain: "week", channel: "both", campaign_id: null, enabled: true };
  it("phrases drops and pacing", () => {
    expect(alertMessage(base, snap(-14, null))).toContain("dropped 14%");
    expect(alertMessage({ ...base, metric: "goal_pacing", direction: "behind_pace" }, snap(null, 72))).toContain("72%");
  });
});
