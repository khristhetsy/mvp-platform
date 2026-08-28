import { describe, it, expect } from "vitest";
import { scoreAssessment, bandFor } from "./rubric";
import { ASSESSMENT_QUESTIONS } from "./questions";

const pick = (fn: (opts: { points: number; id: string }[]) => string): Record<string, string> =>
  Object.fromEntries(ASSESSMENT_QUESTIONS.map((q) => [q.id, fn(q.options)]));

const lowest = (opts: { points: number; id: string }[]) => opts.slice().sort((a, b) => a.points - b.points)[0].id;
const highest = (opts: { points: number; id: string }[]) => opts.slice().sort((a, b) => b.points - a.points)[0].id;

describe("assessment scoring", () => {
  it("bandFor thresholds", () => {
    expect(bandFor(0)).toBe("foundation");
    expect(bandFor(39)).toBe("foundation");
    expect(bandFor(40)).toBe("emerging");
    expect(bandFor(69)).toBe("emerging");
    expect(bandFor(70)).toBe("ready");
    expect(bandFor(100)).toBe("ready");
  });

  it("all-best answers score high and land in Ready", () => {
    const r = scoreAssessment(pick(highest));
    expect(r.leadPrescore).toBe(100);
    expect(r.band).toBe("ready");
  });

  it("all-lowest answers land in Foundation", () => {
    const r = scoreAssessment(pick(lowest));
    expect(r.band).toBe("foundation");
    expect(r.leadPrescore).toBeLessThan(40);
  });

  it("partial / unknown answers are ignored, not thrown", () => {
    const r = scoreAssessment({ stage: "seed", bogus: "nope" });
    expect(r.leadPrescore).toBeGreaterThan(0);
    expect(["foundation", "emerging", "ready"]).toContain(r.band);
  });
});
