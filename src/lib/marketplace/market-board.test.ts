import { describe, expect, it } from "vitest";
import {
  ARROW,
  boardTiles,
  companyChange,
  countInWindow,
  delta,
  directionOf,
  movingAverage,
  sectorBoard,
  signed,
  signedPct,
  snapshotAsOf,
  weeklyCandles,
  type ScoreEvent,
} from "@/lib/marketplace/market-board";

const ev = (companyId: string, at: string, score: number | null): ScoreEvent => ({ companyId, at, score });
const t = (iso: string) => Date.parse(iso);

const events: ScoreEvent[] = [
  ev("a", "2026-09-01T10:00:00Z", 40),
  ev("b", "2026-09-02T10:00:00Z", 80),
  ev("a", "2026-09-10T10:00:00Z", 60),
  ev("c", "2026-09-11T10:00:00Z", 30),
];

describe("snapshotAsOf", () => {
  it("takes each company's newest reading at or before the date", () => {
    expect(snapshotAsOf(events, t("2026-09-05T00:00:00Z"))).toEqual({
      founders: 2, avg: 60, strong: 1, moderate: 1, building: 0,
    });
    expect(snapshotAsOf(events, t("2026-09-30T00:00:00Z"))).toEqual({
      founders: 3, avg: 56.67, strong: 1, moderate: 1, building: 1,
    });
  });
  it("is empty before the first reading and drops a company whose newest reading is null", () => {
    expect(snapshotAsOf(events, t("2026-08-01T00:00:00Z"))).toEqual({ founders: 0, avg: null, strong: 0, moderate: 0, building: 0 });
    const withNull = [...events, ev("b", "2026-09-20T00:00:00Z", null)];
    expect(snapshotAsOf(withNull, t("2026-09-30T00:00:00Z")).founders).toBe(2);
  });
  it("does not depend on input order", () => {
    expect(snapshotAsOf([...events].reverse(), t("2026-09-30T00:00:00Z"))).toEqual(snapshotAsOf(events, t("2026-09-30T00:00:00Z")));
  });
});

describe("delta and boardTiles", () => {
  it("computes change and percent, null percent from a zero or missing base", () => {
    expect(delta(110, 100)).toEqual({ value: 110, change: 10, pct: 10 });
    expect(delta(5, 0).pct).toBeNull();
    expect(delta(5, null)).toEqual({ value: 5, change: 0, pct: null });
  });
  it("compares now with the same board 7 days earlier", () => {
    const tiles = boardTiles(events, t("2026-09-14T00:00:00Z"), 7);
    expect(tiles.founders).toEqual({ value: 3, change: 1, pct: 50 });
    expect(tiles.avgCrr?.value).toBe(56.67);
    expect(tiles.avgCrr?.change).toBeCloseTo(-3.33, 2);
    expect(tiles.windowDays).toBe(7);
  });
  it("has no average when nothing is scored", () => {
    expect(boardTiles([], t("2026-09-14T00:00:00Z")).avgCrr).toBeNull();
  });
});

describe("weeklyCandles", () => {
  it("builds weekly OHLC that opens at the previous close and fills quiet weeks flat", () => {
    const c = weeklyCandles(events, t("2026-09-22T00:00:00Z"));
    expect(c.map((x) => x.weekStart)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(c[0]).toMatchObject({ open: 40, close: 60, high: 60, low: 40, readings: 2 });
    expect(c[1]).toMatchObject({ open: 60, close: 56.67, readings: 2 });
    expect(c[2]).toMatchObject({ open: 56.67, high: 56.67, low: 56.67, close: 56.67, readings: 0 });
    expect(c[3].readings).toBe(0);
  });
  it("returns nothing without readings", () => {
    expect(weeklyCandles([], Date.now())).toEqual([]);
  });
  it("keeps high at or above low and the open and close inside them", () => {
    for (const c of weeklyCandles(events, t("2026-09-22T00:00:00Z"))) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    }
  });
});

describe("movingAverage", () => {
  it("is null until the window fills, then averages the closes", () => {
    const c = weeklyCandles(events, t("2026-09-22T00:00:00Z"));
    const ma = movingAverage(c, 3);
    expect(ma.slice(0, 2)).toEqual([null, null]);
    expect(ma[2]).toBeCloseTo((60 + 56.67 + 56.67) / 3, 1);
  });
});

describe("companyChange", () => {
  it("is first reading against latest, with percent of the first", () => {
    const rows = [ev("n", "2026-09-29T00:00:00Z", 74), ev("n", "2026-11-01T00:00:00Z", 84), ev("x", "2026-10-01T00:00:00Z", 10)];
    const c = companyChange(rows, "n");
    expect(c).toMatchObject({ first: 74, latest: 84, change: 10, firstAt: "2026-09-29T00:00:00Z" });
    expect(c?.pct).toBeCloseTo(13.5, 1);
  });
  it("is null with fewer than two readings", () => {
    expect(companyChange([ev("n", "2026-09-29T00:00:00Z", 74)], "n")).toBeNull();
    expect(companyChange([], "n")).toBeNull();
  });
});

describe("countInWindow, direction and formatting", () => {
  it("counts only dates inside the trailing window", () => {
    const now = t("2026-11-06T00:00:00Z");
    const dates = ["2026-10-06T00:00:00Z", "2026-10-19T00:00:00Z", "2026-11-05T00:00:00Z", "2026-12-01T00:00:00Z", "bad"];
    expect(countInWindow(dates, now, 30)).toBe(2);
    expect(countInWindow(dates, now, 7)).toBe(1);
  });
  it("maps a change to an arrow", () => {
    expect(ARROW[directionOf(3)]).toBe("▲");
    expect(ARROW[directionOf(-1)]).toBe("▼");
    expect(ARROW[directionOf(0)]).toBe("▬");
  });
  it("formats signed numbers and percents", () => {
    expect(signed(10)).toBe("+10");
    expect(signed(-1)).toBe("-1");
    expect(signed(0)).toBe("0");
    expect(signed(7, 2)).toBe("+7.00");
    expect(signedPct(13.51)).toBe("+13.5%");
    expect(signedPct(null)).toBe("n/a");
  });
});

describe("sectorBoard", () => {
  const ind = new Map<string, string | null>([
    ["a", "AI"], ["b", "ai, Fintech"], ["c", "AI"], ["d", "Fintech"], ["e", null],
  ]);
  const ev2: ScoreEvent[] = [
    ev("a", "2026-09-01T00:00:00Z", 60), ev("b", "2026-09-01T00:00:00Z", 70), ev("c", "2026-09-01T00:00:00Z", 80),
    ev("d", "2026-09-01T00:00:00Z", 50), ev("e", "2026-09-01T00:00:00Z", 90),
    ev("a", "2026-09-20T00:00:00Z", 70),
  ];
  it("lists only sectors with 3 or more scored companies, case insensitive, multi sector counted in each", () => {
    const rows = sectorBoard(ev2, ind, t("2026-09-22T00:00:00Z"), 7);
    expect(rows).toEqual([{ sector: "AI", avg: 73.33, change: 3.33 }]);
  });
  it("has null change when the sector was too small a window ago and is empty with no sector reaching 3", () => {
    expect(sectorBoard(ev2, ind, t("2026-09-22T00:00:00Z"), 30)[0].change).toBeNull();
    expect(sectorBoard([ev("a", "2026-09-01T00:00:00Z", 60)], ind, t("2026-09-22T00:00:00Z"))).toEqual([]);
  });
});
