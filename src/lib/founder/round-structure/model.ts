// Pure round structure math for the Analyzer's Round structure calculator.
// No React, no server only imports: the calculator (client) and the analysis
// route (server) both run this same code, so the figures always agree.

export type RoundType = "safe" | "note" | "priced";
export type SafeType = "pre_money" | "post_money";

export type Shareholder = {
  id: string;
  label: string;
  shares: number;
  editable: boolean;
};

export type PostHolder = Shareholder & { pct: number };

export type RoundInputs = {
  roundType: RoundType;
  safeType: SafeType;
  /** Pre-money valuation for a priced round, the valuation cap for a SAFE or note. */
  preMoney: number;
  raiseAmount: number;
  optionPoolPct: number;
  /** 0 means no discount. Used by SAFE and note. */
  discountPct: number;
  /** Note only. Simple annual interest. */
  interestPct: number;
  /** Note only. Months from issue to maturity. */
  maturityMonths: number;
  /** Note only. Percent of principal, exercisable at the next round price. */
  warrantPct: number;
};

export const DEFAULT_SHAREHOLDERS: Shareholder[] = [
  { id: "founder_1", label: "Founder 1", shares: 4_000_000, editable: true },
  { id: "founder_2", label: "Founder 2", shares: 3_000_000, editable: true },
  { id: "employees", label: "Early employees / angels", shares: 1_000_000, editable: true },
];

export const DEFAULT_INPUTS: RoundInputs = {
  roundType: "safe",
  safeType: "post_money",
  preMoney: 5_000_000,
  raiseAmount: 1_000_000,
  optionPoolPct: 10,
  discountPct: 0,
  interestPct: 7,
  maturityMonths: 24,
  warrantPct: 0,
};

export type RoundResult = {
  post: PostHolder[];
  pricePerShare: number | null;
  postMoney: number;
  /** Share of the company the new money holds right after the round. */
  newInvestorPct: number;
  /** Share held by the option pool right after the round. */
  poolPct: number;
  /** Everyone who held shares before the round, together, right after it. */
  existingPct: number;
  founderTotalPct: number;
  /** Note only: principal plus simple interest to maturity. Equals the raise for SAFE and priced. */
  convertingAmount: number;
  interestAmount: number;
  /** Note only: principal times warrant coverage, in dollars of shares at the next round price. */
  warrantValue: number;
  /**
   * SAFE or note with a discount: the next round pre-money above which the cap gives the
   * investor more shares than the discount does, cap divided by (100% minus discount).
   */
  discountBreakEvenPreMoney: number | null;
};

export function computeRound(inputs: RoundInputs, shareholders: Shareholder[] = DEFAULT_SHAREHOLDERS): RoundResult {
  const { roundType, safeType, preMoney, raiseAmount, optionPoolPct } = inputs;
  const postMoney = preMoney + raiseAmount;

  const totalExisting = shareholders.reduce((s, sh) => s + sh.shares, 0);
  const optionPoolShares = Math.round((optionPoolPct / 100) * totalExisting / (1 - optionPoolPct / 100));

  let pricePerShare: number;
  let investorShares: number;
  let investorId: string;
  let investorLabel: string;
  let poolLabel = "Option pool";
  let convertingAmount = raiseAmount;
  let interestAmount = 0;

  if (roundType === "priced") {
    // Pre-money option pool expansion
    const totalPreMoney = totalExisting + optionPoolShares;
    pricePerShare = preMoney / totalPreMoney;
    investorShares = Math.round(raiseAmount / pricePerShare);
    investorId = "new_investor";
    investorLabel = "New investors (this round)";
    poolLabel = "Option pool (expansion)";
  } else if (roundType === "note") {
    // A note cap is a price against the pre-money share count, pool included.
    interestAmount = raiseAmount * (inputs.interestPct / 100) * (inputs.maturityMonths / 12);
    convertingAmount = raiseAmount + interestAmount;
    pricePerShare = preMoney / (totalExisting + optionPoolShares);
    investorShares = Math.round(convertingAmount / pricePerShare);
    investorId = "note_investor";
    investorLabel = "Note investors";
  } else {
    // SAFE, valuation cap = the preMoney slider
    const totalForSafe = safeType === "pre_money" ? totalExisting : totalExisting + optionPoolShares;
    pricePerShare = preMoney / totalForSafe;
    investorShares = Math.round(raiseAmount / pricePerShare);
    investorId = "safe_investor";
    investorLabel = "SAFE investors";
  }

  const totalPost = totalExisting + optionPoolShares + investorShares;
  const post: PostHolder[] = [
    ...shareholders.map((sh) => ({ ...sh, pct: (sh.shares / totalPost) * 100 })),
    { id: "option_pool", label: poolLabel, shares: optionPoolShares, editable: false, pct: (optionPoolShares / totalPost) * 100 },
    { id: investorId, label: investorLabel, shares: investorShares, editable: false, pct: (investorShares / totalPost) * 100 },
  ];

  const newInvestorPct = (investorShares / totalPost) * 100;
  const poolPct = (optionPoolShares / totalPost) * 100;
  const founderTotalPct = post.filter((s) => s.id.startsWith("founder")).reduce((sum, s) => sum + s.pct, 0);
  const hasDiscount = roundType !== "priced" && inputs.discountPct > 0 && inputs.discountPct < 100;

  return {
    post,
    pricePerShare,
    postMoney,
    newInvestorPct,
    poolPct,
    existingPct: 100 - newInvestorPct - poolPct,
    founderTotalPct,
    convertingAmount,
    interestAmount,
    warrantValue: roundType === "note" ? raiseAmount * (inputs.warrantPct / 100) : 0,
    discountBreakEvenPreMoney: hasDiscount ? preMoney / (1 - inputs.discountPct / 100) : null,
  };
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Two decimals, for the converting amount where $5.24M and $5.2M differ. */
export function fmtMoney2(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return fmtMoney(n);
}

export function monthsFromNow(months: number, from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
