import { describe, expect, it } from "vitest";
import { openRatingItems } from "@/lib/crr/open-items";
import type { FactorScore } from "@/lib/ai/readiness-scoring";

const f = (pts: number, max: number, flags: FactorScore["flags"]): FactorScore =>
  ({ pts, max, rating: "Developing", aiSummary: "", subScores: [], evidence: [], flags }) as FactorScore;

describe("openRatingItems", () => {
  it("takes one open flag per factor, largest point gap first, capped", () => {
    const items = openRatingItems(
      {
        a: f(2, 10, [{ severity: "amber", label: "A amber", detail: "" }, { severity: "red", label: "A red", detail: "" }]),
        b: f(9, 10, [{ severity: "red", label: "B red", detail: "" }]),
        c: f(0, 12, [{ severity: "amber", label: "C amber", detail: "" }]),
        d: f(1, 20, [{ severity: "green", label: "D fine", detail: "" }]),
        e: f(3, 8, [{ severity: "amber", label: "E amber", detail: "" }]),
      } as never,
      { a: "Alpha", c: "Gamma" } as never,
      3,
    );
    expect(items.map((i) => i.label)).toEqual(["C amber", "A red", "E amber"]);
    expect(items[0]!.factor).toBe("Gamma");
    expect(items[2]!.factor).toBe("e");
  });

  it("returns nothing when no factor has an open flag", () => {
    expect(openRatingItems({}, {})).toEqual([]);
  });
});
