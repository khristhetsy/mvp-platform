import { describe, expect, it } from "vitest";
import { analyzeOffering, summaryUsesOnlyKnownFigures } from "./analysis";
import { BENCHMARKS, BENCHMARK_SOURCES } from "./benchmarks";
import { computeRound, DEFAULT_INPUTS, type RoundInputs } from "./model";

const safe: RoundInputs = { ...DEFAULT_INPUTS, roundType: "safe", safeType: "post_money", preMoney: 19_800_000, raiseAmount: 4_600_000, optionPoolPct: 23, discountPct: 20 };
const note: RoundInputs = { ...safe, roundType: "note", discountPct: 20, interestPct: 7, maturityMonths: 24, warrantPct: 20 };

describe("round structure math", () => {
  it("keeps the existing SAFE and priced round results unchanged", () => {
    const r = computeRound(DEFAULT_INPUTS);
    // 8,000,000 existing shares, 10% pool: 888,889 pool shares, post-money SAFE cap $5M on 8,888,889 shares.
    expect(r.postMoney).toBe(6_000_000);
    expect(r.newInvestorPct).toBeCloseTo((1 / 6) * 100, 4);
    const p = computeRound({ ...DEFAULT_INPUTS, roundType: "priced" });
    expect(p.newInvestorPct).toBeCloseTo((1 / 6) * 100, 4);
    expect(p.post.some((h) => h.id === "new_investor")).toBe(true);
  });

  it("splits ownership into investors, pool and existing holders that sum to 100", () => {
    const r = computeRound(safe);
    expect(r.newInvestorPct + r.poolPct + r.existingPct).toBeCloseTo(100, 8);
    expect(r.newInvestorPct).toBeCloseTo((4.6 / 24.4) * 100, 2);
  });

  it("computes the discount break even as cap divided by one minus the discount", () => {
    expect(computeRound(safe).discountBreakEvenPreMoney).toBeCloseTo(24_750_000, 0);
    expect(computeRound({ ...safe, discountPct: 0 }).discountBreakEvenPreMoney).toBeNull();
    expect(computeRound({ ...safe, roundType: "priced" }).discountBreakEvenPreMoney).toBeNull();
  });

  it("computes note interest, converting amount and warrant value", () => {
    const r = computeRound(note);
    expect(r.interestAmount).toBeCloseTo(644_000, 0);
    expect(r.convertingAmount).toBeCloseTo(5_244_000, 0);
    expect(r.warrantValue).toBeCloseTo(920_000, 0);
    expect(r.post.some((h) => h.id === "note_investor")).toBe(true);
    expect(r.newInvestorPct + r.poolPct + r.existingPct).toBeCloseTo(100, 8);
  });

  it("gives a SAFE no interest or warrants", () => {
    const r = computeRound(safe);
    expect(r.interestAmount).toBe(0);
    expect(r.warrantValue).toBe(0);
    expect(r.convertingAmount).toBe(safe.raiseAmount);
  });
});

describe("offering analysis", () => {
  it("labels each row from the benchmark and reports the real deltas", () => {
    const a = analyzeOffering(safe);
    const pre = a.rows.find((x) => x.key === "pre")!;
    expect(pre.delta).toBe("+7.6% vs median");
    expect(pre.statusLabel).toBe("In line");
    const raise = a.rows.find((x) => x.key === "raise_all")!;
    expect(raise.delta).toBe("+53.3% vs median");
    expect(raise.statusLabel).toBe("Above median");
    expect(a.rows.find((x) => x.key === "pool")!.statusLabel).toBe("Above range");
    expect(a.rows.find((x) => x.key === "structure")!.statusLabel).toBe("Less common");
  });

  it("explains a pool above the range using the engine's own ownership split", () => {
    const a = analyzeOffering(safe);
    const f = a.findings.find((x) => x.key === "pool")!;
    expect(f.sourceIds).toEqual([4]);
    expect(f.means).toContain(`${a.ownership.pool.toFixed(1)}%`);
    expect(a.ownership.investors + a.ownership.pool + a.ownership.existing).toBeCloseTo(100, 8);
  });

  it("says no dataset for warrant coverage and never invents a benchmark", () => {
    expect(BENCHMARKS.warrantCoverage).toBeNull();
    const w = analyzeOffering(note).rows.find((x) => x.key === "warrant")!;
    expect(w.bench).toBeNull();
    expect(w.statusLabel).toBe("No dataset");
    expect(analyzeOffering({ ...note, warrantPct: 0 }).rows.some((x) => x.key === "warrant")).toBe(false);
  });

  it("only cites sources that exist, and lists each one it uses", () => {
    for (const input of [safe, note, { ...safe, roundType: "priced" as const }]) {
      const a = analyzeOffering(input);
      const ids = new Set(BENCHMARK_SOURCES.map((s) => s.id));
      for (const row of a.rows) if (row.sourceId) expect(ids.has(row.sourceId)).toBe(true);
      for (const f of a.findings) for (const id of f.sourceIds) expect(a.sources.some((s) => s.id === id)).toBe(true);
    }
  });

  it("uses no dashes as punctuation in report text", () => {
    const texts: string[] = [];
    for (const input of [safe, note, { ...safe, roundType: "priced" as const }]) {
      const a = analyzeOffering(input);
      a.rows.forEach((x) => texts.push(x.label, x.delta, x.population, x.statusLabel));
      a.findings.forEach((f) => texts.push(f.title, f.data, f.means, f.next));
    }
    for (const t of texts) expect(t).not.toMatch(/[–—]| - /);
  });

  it("rejects an AI summary that contains a figure the analysis does not", () => {
    const a = analyzeOffering(safe);
    expect(summaryUsesOnlyKnownFigures("Your pool is 23.0%, above the 10 to 15% range.", a.allowedFigures)).toBe(true);
    expect(summaryUsesOnlyKnownFigures("Your pool is 23.0%, and 77% of founders pick less.", a.allowedFigures)).toBe(false);
  });
});
