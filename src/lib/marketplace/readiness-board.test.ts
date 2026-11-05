import { describe, expect, it } from "vitest";
import { buildReadinessBoard, latestScorePerCompany } from "./readiness-board";

describe("buildReadinessBoard", () => {
  it("returns an empty board for no scores", () => {
    const board = buildReadinessBoard([]);
    expect(board.scoredFounders).toBe(0);
    expect(board.avgScore).toBeNull();
    expect(board.bands.every((b) => b.founders === 0 && b.avgScore === null && b.sharePct === 0)).toBe(true);
  });

  it("splits scores into bands at 70 and 40", () => {
    const board = buildReadinessBoard([70, 69.9, 40, 39.9, 100]);
    const by = Object.fromEntries(board.bands.map((b) => [b.key, b.founders]));
    expect(by).toEqual({ strong: 2, moderate: 2, building: 1 });
  });

  it("computes shares and averages to one decimal", () => {
    const board = buildReadinessBoard([90, 85, 60, 5]);
    expect(board.scoredFounders).toBe(4);
    expect(board.avgScore).toBe(60);
    expect(board.bands[0]).toMatchObject({ key: "strong", founders: 2, sharePct: 50, avgScore: 87.5 });
  });

  it("ignores non finite values", () => {
    expect(buildReadinessBoard([Number.NaN, 50]).scoredFounders).toBe(1);
  });
});

describe("latestScorePerCompany", () => {
  it("keeps only the newest score for each company", () => {
    const out = latestScorePerCompany([
      { company_id: "a", created_at: "2026-01-01", score: 10 },
      { company_id: "a", created_at: "2026-03-01", score: 80 },
      { company_id: "b", created_at: "2026-02-01", score: 50 },
    ]);
    expect(out.sort((x, y) => x - y)).toEqual([50, 80]);
  });

  it("drops companies whose newest score is null", () => {
    expect(latestScorePerCompany([{ company_id: "a", created_at: "2026-01-01", score: null }])).toEqual([]);
  });
});
