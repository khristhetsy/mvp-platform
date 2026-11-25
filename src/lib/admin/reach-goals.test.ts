import { describe, it, expect } from "vitest";
import { buildActuals, buildPeriods, goalProgress, monthKey, normalizeReachGoals, reachWindowStart, tally, weekKey } from "@/lib/admin/reach-goals";

// Wednesday Nov 25, 2026, 10:00 PT.
const NOW = new Date("2026-11-25T18:00:00Z");

describe("Reach goals", () => {
  it("keeps whole numbers above zero and turns everything else into no goal", () => {
    const g = normalizeReachGoals({ intro: { sentWeek: 15, openedWeek: 0, sentMonth: "60", openedMonth: 31.6 }, auto: { sentWeek: -3, sentMonth: 9_999_999 } });
    expect(g.intro).toEqual({ sentWeek: 15, openedWeek: null, sentMonth: null, openedMonth: 32 });
    expect(g.auto).toEqual({ sentWeek: null, openedWeek: null, sentMonth: 100_000, openedMonth: null });
  });

  it("returns no goals for a missing or malformed value", () => {
    const none = { sentWeek: null, openedWeek: null, sentMonth: null, openedMonth: null };
    expect(normalizeReachGoals(null)).toEqual({ intro: none, auto: none });
    expect(normalizeReachGoals("x")).toEqual({ intro: none, auto: none });
  });

  it("measures progress only against a set goal", () => {
    expect(goalProgress(10, null)).toBeNull();
    expect(goalProgress(10, 15)).toEqual({ percent: (10 / 15) * 100, met: false, remaining: 5 });
    expect(goalProgress(20, 15)).toEqual({ percent: 100, met: true, remaining: 0 });
  });
});

describe("Reach periods (Pacific time)", () => {
  it("weeks start Monday in PT, not UTC", () => {
    // Sunday Nov 22, 11:30 pm PT is already Monday in UTC: it still belongs to the week of Nov 16.
    expect(weekKey("2026-11-23T07:30:00Z")).toBe("2026-11-16");
    // Monday Nov 23, 12:30 am PT.
    expect(weekKey("2026-11-23T08:30:00Z")).toBe("2026-11-23");
  });

  it("months roll over at PT midnight", () => {
    expect(monthKey("2026-11-01T06:30:00Z")).toBe("2026-10");
    expect(monthKey("2026-11-01T07:30:00Z")).toBe("2026-11");
  });

  it("lists this week and the three before it, newest first", () => {
    const weeks = buildPeriods("week", NOW);
    expect(weeks.map((w) => w.label)).toEqual(["This week (Nov 23 to 29)", "Nov 16 to 22", "Nov 9 to 15", "Nov 2 to 8"]);
    expect(weeks.map((w) => w.current)).toEqual([true, false, false, false]);
  });

  it("names both months when a week crosses a month", () => {
    expect(buildPeriods("week", new Date("2026-10-28T18:00:00Z"))[0].label).toBe("This week (Oct 26 to Nov 1)");
  });

  it("lists this month to date and the three before it, with the year once it changes", () => {
    expect(buildPeriods("month", NOW).map((m) => m.label)).toEqual(["November (to date)", "October", "September", "August"]);
    expect(buildPeriods("month", new Date("2027-01-15T18:00:00Z")).map((m) => m.label)).toEqual(["January (to date)", "December 2026", "November 2026", "October 2026"]);
  });

  it("counts a send in the period it went out and an open in the period it was opened", () => {
    const weeks = buildPeriods("week", NOW);
    const counts = tally(
      [
        { sentAt: "2026-11-24T17:00:00Z", openedAt: "2026-11-24T19:00:00Z" },
        { sentAt: "2026-11-20T17:00:00Z", openedAt: "2026-11-23T17:00:00Z" },
        { sentAt: "2026-11-18T17:00:00Z", openedAt: null },
        { sentAt: null, openedAt: "2026-11-24T19:00:00Z" },
        { sentAt: "2026-09-01T17:00:00Z", openedAt: "2026-09-02T17:00:00Z" },
      ],
      weeks,
      "week",
    );
    expect(counts[0]).toEqual({ sent: 1, opened: 2 });
    expect(counts[1]).toEqual({ sent: 2, opened: 0 });
    expect(counts[2]).toEqual({ sent: 0, opened: 0 });
  });

  it("builds week and month rows for both sections", () => {
    const a = buildActuals({ intro: [{ sentAt: "2026-11-24T17:00:00Z", openedAt: null }], auto: [{ sentAt: "2026-10-05T17:00:00Z", openedAt: "2026-11-24T17:00:00Z" }] }, NOW);
    expect(a.weeks[0].intro).toEqual({ sent: 1, opened: 0 });
    expect(a.weeks[0].auto).toEqual({ sent: 0, opened: 1 });
    expect(a.months[0].auto).toEqual({ sent: 0, opened: 1 });
    expect(a.months[1].auto).toEqual({ sent: 1, opened: 0 });
    expect(a.generatedAt).toBe(NOW.toISOString());
  });

  it("loads from before the oldest month shown", () => {
    expect(reachWindowStart(NOW)).toBe("2026-07-31T00:00:00.000Z");
  });
});
