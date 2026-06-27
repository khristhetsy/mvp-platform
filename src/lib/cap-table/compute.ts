// Pure, deterministic cap-table math. The founder supplies holders and a modeled
// round; this computes ownership and dilution. No AI, no fabricated numbers.

import type { Holder, RoundModel } from "./types";

export interface OwnershipRow {
  holder: Holder;
  pct: number; // 0..1 fully-diluted ownership
}

export interface CapTableSummary {
  totalShares: number;
  rows: OwnershipRow[];
  founderPct: number;
  poolPct: number;
  investorPct: number;
}

export function summarize(holders: Holder[]): CapTableSummary {
  const totalShares = holders.reduce((s, h) => s + Math.max(0, h.shares), 0);
  const rows = holders.map((h) => ({ holder: h, pct: totalShares > 0 ? Math.max(0, h.shares) / totalShares : 0 }));
  const byGroup = (g: Holder["group"]) =>
    totalShares > 0 ? holders.filter((h) => h.group === g).reduce((s, h) => s + Math.max(0, h.shares), 0) / totalShares : 0;
  return {
    totalShares,
    rows,
    founderPct: byGroup("founder"),
    poolPct: byGroup("pool"),
    investorPct: byGroup("investor"),
  };
}

export interface DilutionRow {
  name: string;
  group: Holder["group"] | "new";
  pctBefore: number;
  pctAfter: number;
}

export interface RoundResult {
  preMoney: number;
  newInvestment: number;
  postMoney: number;
  pricePerShare: number | null;
  newShares: number;
  totalAfter: number;
  newInvestorPct: number;
  rows: DilutionRow[];
}

/**
 * Model a priced round: the new money buys newly issued shares at
 * pricePerShare = preMoney / existing fully-diluted shares. Existing holders are
 * diluted pro-rata. (SAFE/note conversion is intentionally out of scope for v1 —
 * those appear as existing line items.)
 */
export function modelRound(holders: Holder[], round: RoundModel): RoundResult {
  const { totalShares } = summarize(holders);
  const preMoney = Math.max(0, round.preMoney);
  const newInvestment = Math.max(0, round.newInvestment);
  const postMoney = preMoney + newInvestment;

  const pricePerShare = totalShares > 0 && preMoney > 0 ? preMoney / totalShares : null;
  const newShares = pricePerShare && pricePerShare > 0 ? newInvestment / pricePerShare : 0;
  const totalAfter = totalShares + newShares;

  const rows: DilutionRow[] = holders.map((h) => ({
    name: h.name,
    group: h.group,
    pctBefore: totalShares > 0 ? Math.max(0, h.shares) / totalShares : 0,
    pctAfter: totalAfter > 0 ? Math.max(0, h.shares) / totalAfter : 0,
  }));

  const newInvestorPct = totalAfter > 0 ? newShares / totalAfter : 0;
  rows.push({ name: "New investor", group: "new", pctBefore: 0, pctAfter: newInvestorPct });

  return { preMoney, newInvestment, postMoney, pricePerShare, newShares, totalAfter, newInvestorPct, rows };
}

/** A sensible starting cap table: two founders + a 10% option pool. */
export function defaultHolders(): Holder[] {
  return [
    { id: "founder-1", name: "Founder 1", group: "founder", shareClass: "Common", shares: 4_500_000 },
    { id: "founder-2", name: "Founder 2", group: "founder", shareClass: "Common", shares: 3_500_000 },
    { id: "pool", name: "Option pool", group: "pool", shareClass: "Options", shares: 1_000_000 },
  ];
}
