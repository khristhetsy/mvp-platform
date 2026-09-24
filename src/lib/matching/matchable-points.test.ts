import { describe, it, expect } from "vitest";
import { DEFAULT_ENGINE_WEIGHTS } from "@/lib/matching/investor-company-matching";
import { founderMeter, investorMeter } from "@/lib/matching/matchable-points";

describe("matchable points meter", () => {
  it("totals the engine weights a founder can answer, active rating excluded", () => {
    const m = founderMeter(
      { industry: null, stages: [], amountBand: null, country: null, state: null, seekingInvestorTypes: [], seekingCapitalTypes: [], arr: null, mrr: null },
      DEFAULT_ENGINE_WEIGHTS,
    );
    const w = DEFAULT_ENGINE_WEIGHTS;
    expect(m.totalPoints).toBe(w.sector + w.stage + w.checkSize + w.geography + w.investorType + w.capitalType + w.arr + w.mrr);
    expect(m.answeredPoints).toBe(0);
  });

  it("counts an answered field at its weight", () => {
    const m = investorMeter(
      { sectors: ["Fintech"], stages: [], checkSizeMin: "250000", checkSizeMax: null, geographies: [], investorType: "", capitalTypes: [], arrBands: [], mrrBands: [" "] },
      DEFAULT_ENGINE_WEIGHTS,
    );
    expect(m.answeredPoints).toBe(DEFAULT_ENGINE_WEIGHTS.sector + DEFAULT_ENGINE_WEIGHTS.checkSize);
  });
});
