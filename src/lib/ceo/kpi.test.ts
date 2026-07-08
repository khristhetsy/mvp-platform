import { describe, it, expect } from "vitest";
import { status, aggregate, compare, deptScore, periodWeeks, formatKpi } from "./kpi";

describe("status", () => {
  it("up_good: green at/above target, red at/below red line, else yellow", () => {
    const k = { direction: "up_good" as const, target: 25, redLine: 18 };
    expect(status(25, k)).toBe("g");
    expect(status(30, k)).toBe("g");
    expect(status(20, k)).toBe("y");
    expect(status(18, k)).toBe("r");
    expect(status(10, k)).toBe("r");
  });
  it("down_good: green at/below target, red at/above red line (bands flip)", () => {
    const k = { direction: "down_good" as const, target: 24, redLine: 48 };
    expect(status(24, k)).toBe("g");
    expect(status(20, k)).toBe("g");
    expect(status(30, k)).toBe("y");
    expect(status(48, k)).toBe("r");
    expect(status(60, k)).toBe("r");
  });
});

describe("aggregate", () => {
  it("sums volume metrics", () => {
    expect(aggregate([10, 20, 30], true)).toBe(60);
  });
  it("averages rate metrics", () => {
    expect(aggregate([20, 30, 40], false)).toBe(30);
  });
  it("returns null for empty period", () => {
    expect(aggregate([], true)).toBeNull();
    expect(aggregate([], false)).toBeNull();
  });
});

describe("compare", () => {
  it("returns null when baseline is missing or zero (pre-launch → n/a)", () => {
    expect(compare(100, null, "up_good")).toBeNull();
    expect(compare(100, 0, "up_good")).toBeNull();
    expect(compare(null, 100, "up_good")).toBeNull();
  });
  it("up_good: a rise is good", () => {
    expect(compare(110, 100, "up_good")).toEqual({ pct: 10, good: true });
    expect(compare(90, 100, "up_good")).toEqual({ pct: -10, good: false });
  });
  it("down_good: a fall is good (direction-aware)", () => {
    expect(compare(90, 100, "down_good")).toEqual({ pct: -10, good: true });
    expect(compare(110, 100, "down_good")).toEqual({ pct: 10, good: false });
  });
});

describe("deptScore", () => {
  it("weights KPIs (activation counts triple)", () => {
    // one green weight-3, one red weight-1 → (3*1 + 1*0)/(3+1) * 10 = 7.5
    expect(deptScore([{ status: "g", weight: 3 }, { status: "r", weight: 1 }])).toBe(7.5);
  });
  it("yellow scores half points", () => {
    expect(deptScore([{ status: "y", weight: 1 }])).toBe(5);
  });
  it("returns null with no weighted KPIs", () => {
    expect(deptScore([])).toBeNull();
  });
});

describe("periodWeeks / formatKpi", () => {
  it("period week counts", () => {
    expect(periodWeeks("wk")).toBe(1);
    expect(periodWeeks("qtr")).toBe(13);
    expect(periodWeeks("ytd", 27)).toBe(27);
  });
  it("formats by code", () => {
    expect(formatKpi(25, "%")).toBe("25%");
    expect(formatKpi(12, "$")).toBe("$12");
    expect(formatKpi(3.8, "x")).toBe("3.8×");
    expect(formatKpi(31, "h")).toBe("31h");
    expect(formatKpi(400, "n")).toBe("400");
  });
});
