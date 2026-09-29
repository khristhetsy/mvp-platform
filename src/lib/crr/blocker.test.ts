/**
 * Naming the thing in the way.
 */
import { describe, it, expect } from "vitest";
import {
  gateChip, namesOf, outreachBlocker, weakestDimensions,
  type BlockerDimension, type CrrSummary,
} from "@/lib/crr/blocker";

const dim = (label: string, score: number, weight: number): BlockerDimension => ({
  label, score, weight, headroom: ((100 - score) * weight) / 100,
});

// Seed weights: team 30, traction 25, capTable 20, financial 15, narrative 10.
const DIMS = [
  dim("Narrative", 60, 10),
  dim("Team", 70, 30),
  dim("Financial", 53, 15),
  dim("Traction", 48, 25),
  dim("Cap table", 20, 20),
];

const crr = (over: Partial<CrrSummary> = {}): CrrSummary => ({
  score: 51, gate: 65, pointsToGate: 14, outreachUnlocked: false, dimensions: DIMS, ...over,
});

describe("which dimension to work on", () => {
  it("ranks by points left on the table, not by how low the dimension is", () => {
    // Cap table 20/100 leaves 16 points; traction 48/100 leaves 13.
    expect(weakestDimensions(DIMS).map((d) => d.label)).toEqual(["Cap table", "Traction"]);
  });

  it("would rank differently at another stage, because the weights differ", () => {
    // Narrative at 20% is worth 8 points at Pre-seed's weight of 30.
    const preSeed = [dim("Narrative", 20, 30), dim("Cap table", 20, 10)];
    expect(weakestDimensions(preSeed, 1)[0].label).toBe("Narrative");
  });

  it("leaves out a dimension with nothing left to give", () => {
    expect(weakestDimensions([dim("Team", 100, 30), dim("Traction", 90, 25)]).map((d) => d.label))
      .toEqual(["Traction"]);
  });

  it("copes with nothing to rank", () => {
    expect(weakestDimensions([])).toEqual([]);
    expect(weakestDimensions(DIMS, 0)).toEqual([]);
  });

  it("writes the names as a sentence", () => {
    expect(namesOf(weakestDimensions(DIMS))).toBe("Cap table and Traction");
    expect(namesOf(weakestDimensions(DIMS, 1))).toBe("Cap table");
    expect(namesOf([])).toBe("");
  });
});

describe("what the founder is told", () => {
  it("names the score and the gate", () => {
    expect(outreachBlocker(crr())?.title).toBe("Your CRR is 51 — outreach unlocks at 65");
  });

  it("names the two dimensions costing the most, in points", () => {
    expect(outreachBlocker(crr())?.description)
      .toBe("Cap table and Traction are costing you the most: cap table 4 of 20, traction 12 of 25.");
  });

  it("says nothing once outreach is open", () => {
    expect(outreachBlocker(crr({ outreachUnlocked: true }))).toBeNull();
  });

  it("says nothing when nobody has scored them — a 0 they did not earn is worse", () => {
    expect(outreachBlocker(crr({ score: null }))).toBeNull();
  });

  it("falls back to the distance when there are no dimensions to blame", () => {
    expect(outreachBlocker(crr({ dimensions: [] }))?.description).toBe("You are 14 points away.");
  });

  it("gets the plural right at one point out", () => {
    expect(outreachBlocker(crr({ dimensions: [], pointsToGate: 1 }))?.description)
      .toBe("You are 1 point away.");
  });
});

describe("the chip", () => {
  it("shows the gate while held", () => {
    expect(gateChip(crr())).toBe("CRR 51 · gate 65");
  });

  it("says outreach is open once through", () => {
    expect(gateChip(crr({ score: 72, outreachUnlocked: true }))).toBe("CRR 72 · outreach open");
  });

  it("does not invent a number for an unscored company", () => {
    expect(gateChip(crr({ score: null }))).toBe("CRR not scored yet");
  });
});
