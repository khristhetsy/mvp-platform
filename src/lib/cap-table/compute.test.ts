import { describe, it, expect } from "vitest";
import { summarize, modelRound, defaultHolders } from "@/lib/cap-table/compute";
import type { Holder } from "@/lib/cap-table/types";

const HOLDERS: Holder[] = [
  { id: "1", name: "A", group: "founder", shareClass: "Common", shares: 4_500_000 },
  { id: "2", name: "B", group: "founder", shareClass: "Common", shares: 3_500_000 },
  { id: "3", name: "Pool", group: "pool", shareClass: "Options", shares: 1_500_000 },
  { id: "4", name: "Seed", group: "investor", shareClass: "Pref", shares: 1_818_000 },
];

describe("cap table — summarize", () => {
  it("ownership rows always sum to 100%", () => {
    const s = summarize(HOLDERS);
    const total = s.rows.reduce((a, r) => a + r.pct, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    expect(Math.abs(s.founderPct + s.poolPct + s.investorPct - 1)).toBeLessThan(1e-9);
  });

  it("handles a zero-share holder without NaN", () => {
    const s = summarize([{ id: "x", name: "z", group: "founder", shareClass: "C", shares: 0 }]);
    expect(s.rows[0].pct).toBe(0);
  });
});

describe("cap table — modelRound (dilution)", () => {
  it("post-money = pre + new, and after-percentages sum to 100%", () => {
    const r = modelRound(HOLDERS, { newInvestment: 2_000_000, preMoney: 8_000_000 });
    expect(r.postMoney).toBe(10_000_000);
    const afterSum = r.rows.reduce((a, x) => a + x.pctAfter, 0);
    expect(Math.abs(afterSum - 1)).toBeLessThan(1e-9);
  });

  it("new investor ownership equals investment / post-money", () => {
    const r = modelRound(HOLDERS, { newInvestment: 2_000_000, preMoney: 8_000_000 });
    expect(Math.abs(r.newInvestorPct - 0.2)).toBeLessThan(1e-9);
  });

  it("dilutes existing holders pro-rata", () => {
    const before = summarize(HOLDERS).founderPct;
    const r = modelRound(HOLDERS, { newInvestment: 2_000_000, preMoney: 8_000_000 });
    const after = r.rows.filter((x) => x.group === "founder").reduce((a, x) => a + x.pctAfter, 0);
    expect(Math.abs(after - before * (1 - 0.2))).toBeLessThan(1e-9);
  });

  it("is safe with no pre-money (no price, no new shares)", () => {
    const r = modelRound(HOLDERS, { newInvestment: 1_000_000, preMoney: 0 });
    expect(r.pricePerShare).toBeNull();
    expect(r.newShares).toBe(0);
  });

  it("ships a sensible default cap table", () => {
    expect(defaultHolders()).toHaveLength(3);
  });
});
