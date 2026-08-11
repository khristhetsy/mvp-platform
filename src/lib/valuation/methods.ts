// Valuation Studio — calculation engine (spec §3, §4).
// Pure TypeScript, no UI, no I/O. One function per method + a stage router.
// This is the part that must never be wrong: a saved valuation stores these
// outputs and must reproduce exactly what the founder saw. Unit-tested in
// methods.test.ts — change a formula, update the test.

export type Stage = "preseed" | "seed" | "revenue";

export type MethodCode = "BRK" | "SCR" | "RFS" | "VCM" | "OWN" | "TCM" | "PRC" | "DCF" | "AST";
export type MethodFamily = "Angel" | "Venture" | "Banker" | "Family office";

export type MethodResult = {
  code: MethodCode;
  name: string;
  family: MethodFamily;
  low: number;
  high: number;
  /** Human-readable basis line naming the inputs that produced the number. */
  basis: string;
};

export type ValuationInputs = {
  company: string;
  sector: string;
  // Angel
  berkusCap: number;
  berkus: number[]; // 5 milestone % (0-100)
  regionalBase: number;
  scorecard: number[]; // 7 factor ratings (50-150, as %)
  rfs: number[]; // 12 risk scores (-2..+2)
  // Round
  raiseAmount: number;
  ownershipLow: number; // %
  ownershipHigh: number; // %
  // VC method
  exitRevenue: number;
  exitMultiple: number;
  targetROILow: number; // x
  targetROIHigh: number; // x
  futureDilution: number; // %
  // Comps
  arr: number;
  growthRate: number; // %
  compLow: number; // x
  compHigh: number; // x
  illiquidityDiscount: number; // %
  controlPremium: number; // %
  // DCF
  fcfMargin: number; // %
  discountRate: number; // %
  terminalGrowth: number; // %
  // Floor
  assetBase: number;
};

/** Scorecard factor weights (spec §4). Sum = 1.00. */
export const SCORECARD_WEIGHTS: readonly number[] = [0.3, 0.25, 0.15, 0.1, 0.1, 0.05, 0.05];

/** Compact currency label used inside basis strings. */
export function money(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** Median — used for the converged range so one aggressive method can't drag it. */
export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Run the stage-appropriate methods against the inputs. Returns only methods
 * that produce a finite, positive range (a method with insufficient inputs is
 * silently skipped, never shown as $0). Deterministic and side-effect free.
 */
export function computeMethods(stage: Stage, inp: ValuationInputs): MethodResult[] {
  const out: MethodResult[] = [];
  const push = (
    code: MethodCode,
    name: string,
    family: MethodFamily,
    low: number,
    high: number,
    basis: string,
  ) => {
    if (!isFinite(low) || !isFinite(high) || high <= 0) return;
    out.push({ code, name, family, low: Math.max(0, low), high: Math.max(0, high), basis });
  };

  // BRK Berkus (angel, pre-revenue) — Σ(milestone% × cap), range ±15%.
  if (stage === "preseed") {
    const cap = inp.berkusCap;
    const val = inp.berkus.reduce((a, v) => a + (v / 100) * cap, 0);
    push("BRK", "Berkus Method", "Angel", val * 0.85, val * 1.15,
      `${inp.berkus.length} milestones capped at ${money(cap)} each`);
  }

  // SCR Scorecard (angel + early VC) — regional_base × Σ(weight × rating), ±15%.
  if (stage === "preseed" || stage === "seed") {
    const mult = SCORECARD_WEIGHTS.reduce((a, w, i) => a + w * ((inp.scorecard[i] ?? 100) / 100), 0);
    const v = inp.regionalBase * mult;
    push("SCR", "Scorecard (Payne)", "Angel", v * 0.85, v * 1.15,
      `${money(inp.regionalBase)} regional base × ${mult.toFixed(2)}`);
  }

  // RFS Risk Factor Summation (angel) — base + (Σ scores × $250K), ±15%.
  if (stage === "preseed") {
    const adj = inp.rfs.reduce((a, v) => a + v, 0) * 250000;
    const v = inp.regionalBase + adj;
    push("RFS", "Risk Factor Summation", "Angel", v * 0.85, v * 1.15,
      `${money(inp.regionalBase)} base ${adj >= 0 ? "+" : "−"} ${money(Math.abs(adj))} risk adjustment`);
  }

  // VCM VC Method (seed + revenue) — exit ÷ target return × (1−dilution) − raise.
  if (stage === "seed" || stage === "revenue") {
    const exitVal = inp.exitRevenue * inp.exitMultiple;
    const postLow = exitVal / inp.targetROIHigh;
    const postHigh = exitVal / inp.targetROILow;
    const dil = 1 - inp.futureDilution / 100;
    push("VCM", "VC Method", "Venture",
      postLow * dil - inp.raiseAmount, postHigh * dil - inp.raiseAmount,
      `${money(exitVal)} exit ÷ ${inp.targetROILow}–${inp.targetROIHigh}× target return`);
  }

  // OWN ownership-target (preseed + seed) — raise ÷ ownership% − raise.
  if (stage === "preseed" || stage === "seed") {
    const postLow = inp.raiseAmount / (inp.ownershipHigh / 100);
    const postHigh = inp.raiseAmount / (inp.ownershipLow / 100);
    push("OWN", "Ownership-target pricing", "Venture",
      postLow - inp.raiseAmount, postHigh - inp.raiseAmount,
      `${money(inp.raiseAmount)} raise for ${inp.ownershipLow}–${inp.ownershipHigh}% of the company`);
  }

  // TCM trading comps (seed + revenue, ARR>0) — ARR × multiple × (1−discount).
  if ((stage === "seed" || stage === "revenue") && inp.arr > 0) {
    const disc = 1 - inp.illiquidityDiscount / 100;
    push("TCM", "Trading comparables", "Banker",
      inp.arr * inp.compLow * disc, inp.arr * inp.compHigh * disc,
      `${money(inp.arr)} ARR × ${inp.compLow}–${inp.compHigh}× less ${inp.illiquidityDiscount}% private discount`);
  }

  // PRC precedent transactions (revenue, ARR>0) — comps × (1+control premium).
  if (stage === "revenue" && inp.arr > 0) {
    const prem = 1 + inp.controlPremium / 100;
    const disc = 1 - inp.illiquidityDiscount / 100;
    push("PRC", "Precedent transactions", "Banker",
      inp.arr * inp.compLow * prem * disc, inp.arr * inp.compHigh * prem * disc,
      `M&A multiples incl. ${inp.controlPremium}% control premium`);
  }

  // DCF (revenue, ARR>0) — 5-yr FCF + Gordon terminal; low end uses base+500bps.
  if (stage === "revenue" && inp.arr > 0) {
    const yrs = 5;
    let rev = inp.arr;
    let pv = 0;
    for (let t = 1; t <= yrs; t++) {
      rev = rev * (1 + inp.growthRate / 100);
      const fcf = rev * (inp.fcfMargin / 100);
      pv += fcf / Math.pow(1 + inp.discountRate / 100, t);
    }
    const finalFcf = rev * (inp.fcfMargin / 100) * (1 + inp.terminalGrowth / 100);
    const termLow = finalFcf / ((inp.discountRate + 5) / 100 - inp.terminalGrowth / 100);
    const termHigh = finalFcf / (inp.discountRate / 100 - inp.terminalGrowth / 100);
    const d = Math.pow(1 + inp.discountRate / 100, yrs);
    push("DCF", "Discounted cash flow", "Banker",
      pv + termLow / d, pv + termHigh / d,
      `5-yr FCF at ${inp.discountRate}% discount, ${inp.terminalGrowth}% terminal growth`);
  }

  // AST asset & IP backing (any stage, asset base > 0) — × 0.8 to × 1.4.
  if (inp.assetBase > 0) {
    push("AST", "Asset & IP backing", "Family office",
      inp.assetBase * 0.8, inp.assetBase * 1.4,
      `${money(inp.assetBase)} recoverable asset and IP base`);
  }

  return out;
}

/** Converged range = median of method lows to median of method highs (spec §3). */
export function convergedRange(methods: MethodResult[]): { low: number; high: number } {
  return {
    low: median(methods.map((m) => m.low)),
    high: median(methods.map((m) => m.high)),
  };
}
