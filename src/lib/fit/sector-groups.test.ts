import { describe, it, expect } from "vitest";
import { groupSectors, valuesForChips } from "./sector-groups";

const LIVE_SAMPLE = [
  "AI", "AI & ML", "AI/ML", "AI/Deep Tech", "Artificial Intelligence", "Machine Learning",
  "Software", "SaaS", "Healthcare", "Digital Health", "Apparel", "Other", "Zeppelins",
];

describe("groupSectors", () => {
  it("merges the AI spellings into one chip carrying every stored value", () => {
    const groups = groupSectors(LIVE_SAMPLE);
    const ai = groups.flatMap((g) => g.chips).find((c) => c.label === "AI and Machine Learning");
    expect(ai?.values.sort()).toEqual(["AI", "AI & ML", "AI/Deep Tech", "AI/ML", "Artificial Intelligence", "Machine Learning"].sort());
  });

  it("never drops a sector: unclaimed values become their own chip, Other last", () => {
    const groups = groupSectors(LIVE_SAMPLE);
    const covered = new Set(groups.flatMap((g) => g.chips.flatMap((c) => c.values)));
    for (const s of LIVE_SAMPLE) expect(covered.has(s)).toBe(true);
    const more = groups.find((g) => g.name === "More sectors");
    expect(more?.chips.map((c) => c.label)).toEqual(["Zeppelins", "Other"]);
  });

  it("omits chips with no investor behind them", () => {
    const groups = groupSectors(["Software"]);
    const labels = groups.flatMap((g) => g.chips.map((c) => c.label));
    expect(labels).toEqual(["Software and SaaS"]);
  });

  it("maps chip keys back to stored values", () => {
    const groups = groupSectors(LIVE_SAMPLE);
    const values = valuesForChips(groups, ["healthcare", "apparel"]);
    expect(values.sort()).toEqual(["Apparel", "Digital Health", "Healthcare"]);
  });
});
