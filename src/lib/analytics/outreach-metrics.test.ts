/**
 * Counting outreach without lying about it.
 */
import { describe, it, expect } from "vitest";
import {
  comparisonRange, delta, followUpDebt, funnel, inRange, messages,
  rangeFor, rateIsMeaningful, segments, series,
  type OutreachRecord,
} from "@/lib/analytics/outreach-metrics";

const NOW = new Date("2026-09-22T15:00:00.000Z"); // a Tuesday

const rec = (over: Partial<OutreachRecord> = {}): OutreachRecord => ({
  id: Math.random().toString(36).slice(2),
  investorName: "An investor",
  investorType: "Family Office",
  sectors: ["HealthTech"],
  geography: "United States",
  subject: "Meet us",
  sentAt: "2026-09-22T09:00:00.000Z",
  openedAt: null,
  clickedAt: null,
  repliedAt: null,
  followedUpAt: null,
  channel: "manual",
  ...over,
});

describe("the window a period covers", () => {
  it("takes today for a day", () => {
    const r = rangeFor("day", NOW);
    expect(r.start.toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-23T00:00:00.000Z");
  });

  it("starts the week on Monday", () => {
    expect(rangeFor("week", NOW).start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("takes the calendar quarter", () => {
    const r = rangeFor("quarter", NOW);
    expect(r.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(r.label).toBe("Q3 2026");
  });

  it("takes the calendar year", () => {
    expect(rangeFor("year", NOW).label).toBe("2026");
  });
});

describe("what a comparison points at", () => {
  it("points at the week before", () => {
    const r = comparisonRange("week", "prev", NOW);
    expect(r?.start.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("points at the quarter before", () => {
    expect(comparisonRange("quarter", "prev", NOW)?.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("points at the same quarter last year", () => {
    expect(comparisonRange("quarter", "year", NOW)?.start.toISOString()).toBe("2025-07-01T00:00:00.000Z");
  });

  it("points nowhere when comparison is off", () => {
    expect(comparisonRange("week", "none", NOW)).toBeNull();
  });
});

describe("filtering to a window", () => {
  it("anchors on the send, not on the reply", () => {
    // Sent in August, replied in September: it belongs to August's sends.
    const r = rec({ sentAt: "2026-08-10T09:00:00.000Z", repliedAt: "2026-09-02T09:00:00.000Z" });
    expect(inRange([r], rangeFor("week", NOW))).toHaveLength(0);
    expect(inRange([r], rangeFor("quarter", NOW))).toHaveLength(1);
  });

  it("returns nothing for no window", () => {
    expect(inRange([rec()], null)).toEqual([]);
  });
});

describe("the funnel", () => {
  const records = [
    rec({ openedAt: "2026-09-22T10:00:00.000Z" }),
    rec({ openedAt: "2026-09-22T10:00:00.000Z", clickedAt: "2026-09-22T11:00:00.000Z" }),
    // A reply with no recorded open — the provider missed the pixel.
    rec({ repliedAt: "2026-09-22T12:00:00.000Z" }),
    rec(),
    rec({ sentAt: null }),
  ];
  const f = funnel(records);

  it("counts only what was actually sent", () => {
    expect(f[0].count).toBe(4);
  });

  it("treats a reply as an open, because a missed pixel is not the founder's doing", () => {
    expect(f[1].count).toBe(3);
  });

  it("keeps each step a subset of the one above", () => {
    expect(f[1].count).toBeGreaterThanOrEqual(f[2].count);
    expect(f[2].count).toBeGreaterThanOrEqual(f[3].count);
  });

  it("reports each step as a share of sends", () => {
    expect(f[3].ofSent).toBe(25);
  });

  it("does not divide by zero", () => {
    expect(funnel([])[0].ofSent).toBe(0);
  });
});

describe("segments", () => {
  const records = [
    rec({ investorType: "Family Office", repliedAt: "x" }),
    rec({ investorType: "Family Office" }),
    rec({ investorType: "Venture Capital" }),
    rec({ investorType: null }),
  ];

  it("ranks by reply rate", () => {
    const s = segments(records, "type");
    expect(s[0]).toEqual({ label: "Family Office", sent: 2, replied: 1, rate: 50 });
  });

  it("keeps the unknowns rather than dropping sends", () => {
    expect(segments(records, "type").map((s) => s.label)).toContain("Unknown");
  });

  it("counts a multi-sector investor in each of their sectors", () => {
    const s = segments([rec({ sectors: ["HealthTech", "Deep Tech"], repliedAt: "x" })], "sector");
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.rate === 100)).toBe(true);
  });

  it("flags a rate nobody should read", () => {
    expect(rateIsMeaningful(2)).toBe(false);
    expect(rateIsMeaningful(5)).toBe(true);
  });
});

describe("the series", () => {
  it("gives a week seven days, Monday first", () => {
    const r = rangeFor("week", NOW);
    const s = series([rec({ sentAt: "2026-09-22T09:00:00.000Z", repliedAt: "x" })], "week", r);
    expect(s).toHaveLength(7);
    expect(s[0].label).toBe("Mon");
    expect(s[1]).toMatchObject({ label: "Tue", sent: 1, replied: 1 });
  });

  it("gives a quarter its three months", () => {
    const r = rangeFor("quarter", NOW);
    const s = series([rec({ sentAt: "2026-08-04T09:00:00.000Z" })], "quarter", r);
    expect(s.map((b) => b.label)).toEqual(["Jul", "Aug", "Sep"]);
    expect(s[1].sent).toBe(1);
  });

  it("gives a year four quarters", () => {
    expect(series([], "year", rangeFor("year", NOW))).toHaveLength(4);
  });

  it("ignores a record outside the window rather than misplacing it", () => {
    const s = series([rec({ sentAt: "2026-01-04T09:00:00.000Z" })], "week", rangeFor("week", NOW));
    expect(s.every((b) => b.sent === 0)).toBe(true);
  });
});

describe("message performance", () => {
  it("groups by subject and ranks by replies", () => {
    const rows = messages([
      rec({ subject: "A", repliedAt: "x" }),
      rec({ subject: "A" }),
      rec({ subject: "B", openedAt: "x" }),
    ]);
    expect(rows[0]).toEqual({ subject: "A", sent: 2, opened: 1, replied: 1 });
    expect(rows[1]).toEqual({ subject: "B", sent: 1, opened: 1, replied: 0 });
  });

  it("says so when no subject was recorded", () => {
    expect(messages([rec({ subject: null })])[0].subject).toBe("(no subject recorded)");
  });
});

describe("follow-up debt", () => {
  const old = "2026-09-10T09:00:00.000Z";

  it("lists who opened and never heard back", () => {
    const d = followUpDebt([rec({ openedAt: old })], { now: NOW });
    expect(d).toHaveLength(1);
    expect(d[0].daysSince).toBe(12);
  });

  it("drops anybody who replied — they are not owed a nudge", () => {
    expect(followUpDebt([rec({ openedAt: old, repliedAt: old })], { now: NOW })).toHaveLength(0);
  });

  it("drops anybody already chased since", () => {
    expect(followUpDebt([rec({ openedAt: old, followedUpAt: "2026-09-22T08:00:00.000Z" })], { now: NOW }))
      .toHaveLength(0);
  });

  it("waits a few days before calling it debt", () => {
    expect(followUpDebt([rec({ openedAt: "2026-09-22T08:00:00.000Z" })], { now: NOW })).toHaveLength(0);
  });

  it("ignores somebody who never opened", () => {
    expect(followUpDebt([rec()], { now: NOW })).toHaveLength(0);
  });

  it("puts the longest wait first", () => {
    const d = followUpDebt(
      [rec({ openedAt: "2026-09-18T09:00:00.000Z" }), rec({ openedAt: old })],
      { now: NOW },
    );
    expect(d[0].daysSince).toBe(12);
  });
});

describe("deltas", () => {
  it("reports a rise and a fall", () => {
    expect(delta(6, 3)).toEqual({ now: 6, was: 3, pct: 100, direction: "up" });
    expect(delta(3, 6)).toEqual({ now: 3, was: 6, pct: -50, direction: "down" });
  });

  it("reports nothing to compare rather than a rise from zero", () => {
    expect(delta(6, null)).toEqual({ now: 6, was: null, pct: null, direction: "flat" });
  });

  it("refuses a percentage against a zero base", () => {
    expect(delta(6, 0)).toEqual({ now: 6, was: 0, pct: null, direction: "up" });
  });

  it("calls nothing-to-nothing flat", () => {
    expect(delta(0, 0)).toEqual({ now: 0, was: 0, pct: 0, direction: "flat" });
  });
});
