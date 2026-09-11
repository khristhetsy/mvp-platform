import { describe, it, expect } from "vitest";
import { generateOccurrences, nextAfter, upcoming, totalCount, type RecurrenceRule } from "./recurrence";

const base: RecurrenceRule = { freq: "weekly", interval: 1, weekdays: [], timeLocal: "08:15", startDate: "2026-09-14", endType: "never" };
const dayName = (ms: number) => new Date(ms).getDay();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("generateOccurrences — daily", () => {
  it("every day, capped after N", () => {
    const occ = generateOccurrences({ ...base, freq: "daily", endType: "after", endCount: 5 });
    expect(occ).toHaveLength(5);
    expect(iso(occ[0])).toBe("2026-09-14");
    expect(iso(occ[1])).toBe("2026-09-15");
  });
  it("every 3 days", () => {
    const occ = generateOccurrences({ ...base, freq: "daily", interval: 3, endType: "after", endCount: 3 });
    expect(iso(occ[0])).toBe("2026-09-14");
    expect(iso(occ[1])).toBe("2026-09-17");
    expect(iso(occ[2])).toBe("2026-09-20");
  });
});

describe("generateOccurrences — weekly", () => {
  it("Tue & Thu only, all land on those weekdays", () => {
    // 2026-09-14 is a Monday; weekdays Tue(2) & Thu(4)
    const occ = generateOccurrences({ ...base, weekdays: [2, 4], endType: "after", endCount: 4 });
    expect(occ).toHaveLength(4);
    expect(occ.every((ms) => [2, 4].includes(dayName(ms)))).toBe(true);
    expect(iso(occ[0])).toBe("2026-09-15"); // Tue
    expect(iso(occ[1])).toBe("2026-09-17"); // Thu
    expect(iso(occ[2])).toBe("2026-09-22"); // next Tue
  });
  it("every 2 weeks skips the off week", () => {
    const occ = generateOccurrences({ ...base, interval: 2, weekdays: [1], endType: "after", endCount: 3 }); // Mondays
    expect(iso(occ[0])).toBe("2026-09-14");
    expect(iso(occ[1])).toBe("2026-09-28"); // +2 weeks
    expect(iso(occ[2])).toBe("2026-10-12");
  });
  it("stops on end date", () => {
    const occ = generateOccurrences({ ...base, weekdays: [1], endType: "on_date", endDate: "2026-09-28" });
    expect(occ.map(iso)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"]);
  });
});

describe("generateOccurrences — monthly", () => {
  it("same day each month", () => {
    const occ = generateOccurrences({ ...base, freq: "monthly", startDate: "2026-09-14", endType: "after", endCount: 3 });
    expect(occ.map(iso)).toEqual(["2026-09-14", "2026-10-14", "2026-11-14"]);
  });
});

describe("nextAfter / upcoming / totalCount", () => {
  const rule: RecurrenceRule = { ...base, weekdays: [2, 4], endType: "on_date", endDate: "2026-12-31" };
  it("nextAfter returns the first future occurrence", () => {
    const afterFirst = generateOccurrences(rule)[0];
    const nxt = nextAfter(rule, afterFirst)!;
    expect(nxt).toBeGreaterThan(afterFirst);
    expect([2, 4]).toContain(dayName(nxt));
  });
  it("upcoming returns N from a point", () => {
    expect(upcoming(rule, Date.parse("2026-09-14T00:00:00"), 4)).toHaveLength(4);
  });
  it("never recurrence is bounded by horizon (no infinite loop)", () => {
    expect(totalCount({ ...base, weekdays: [1], endType: "never" })).toBeGreaterThan(0);
    expect(totalCount({ ...base, weekdays: [1], endType: "never" })).toBeLessThanOrEqual(500);
  });
});
