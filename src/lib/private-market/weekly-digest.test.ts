import { describe, expect, it } from "vitest";
import type { ScoreEvent } from "@/lib/marketplace/market-board";
import { founderRating, latestScores, nothingChanged, ordinal, rangeLabel, ratingMoves, type DigestMarket } from "./weekly-digest";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 6, 12);
const ev = (companyId: string, daysAgo: number, score: number | null): ScoreEvent => ({ companyId, at: new Date(NOW - daysAgo * DAY).toISOString(), score });

const events = [ev("a", 40, 25), ev("a", 10, 84), ev("b", 30, 90), ev("b", 2, 94), ev("c", 3, 3), ev("c", 1, 90), ev("d", 20, 50)];

describe("weekly digest math", () => {
  it("takes the latest score per company at a point in time", () => {
    expect(latestScores(events, NOW).get("b")).toBe(94);
    expect(latestScores(events, NOW - 7 * DAY).get("b")).toBe(90);
    expect(latestScores(events, NOW - 7 * DAY).has("c")).toBe(false);
  });

  it("lists rating moves in the window, biggest first, leaving unchanged ratings out", () => {
    const moves = ratingMoves(events, NOW);
    expect(moves.map((m) => m.companyId)).toEqual(["c", "b"]);
    expect(moves[0]).toMatchObject({ from: null, to: 90 });
    expect(moves[1]).toMatchObject({ from: 90, to: 94, change: 4 });
  });

  it("builds a founder's rating with rank, week change and change since the first reading", () => {
    const r = founderRating(events, "a", NOW);
    expect(r).toMatchObject({ score: 84, band: "strong", weekChange: 0, weekAgo: 84, firstScore: 25, sinceFirst: 59, rank: 3, of: 4 });
  });

  it("returns null for a company with no score", () => {
    expect(founderRating(events, "zzz", NOW)).toBeNull();
  });

  it("has no week change for a founder first scored inside the window", () => {
    expect(founderRating(events, "c", NOW)).toMatchObject({ weekChange: null, sinceFirst: 87 });
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 9, 11, 12, 13, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "9th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("writes the date range", () => {
    expect(rangeLabel(NOW)).toBe("30 Oct to 6 Nov 2026");
  });

  it("knows when nothing changed", () => {
    const m: DigestMarket = { range: "", asOfLabel: "", tiles: [{ label: "A", value: "1", change: 0, delta: null }], avgCrr: 1, gainers: [], sectors: [], approvedTotal: 1, newlyApproved: { count: 0, scored: 0 }, moves: [] };
    expect(nothingChanged(m)).toBe(true);
    expect(nothingChanged({ ...m, moves: [{ symbol: "X", from: 1, to: 2 }] })).toBe(false);
    expect(nothingChanged({ ...m, tiles: [{ label: "A", value: "1", change: 2, delta: null }] })).toBe(false);
  });
});
