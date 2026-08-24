// Derived fields (build spec §5). Rules over filed data, not inference — both are
// stamped as derived in score_notes so nobody mistakes them for founder-stated.

import type { FormDFiling } from "./types";

/** Funding stage inferred from offering size + revenue disclosure. */
export function deriveFundingStage(f: Pick<FormDFiling, "totalOffering" | "revenueRange">): string | null {
  const amt = f.totalOffering;
  if (amt == null) return null;
  const hasRevenue = Boolean(f.revenueRange);
  if (amt < 1_000_000 && !hasRevenue) return "Pre-seed";
  if (amt >= 1_000_000 && amt <= 5_000_000) return "Seed";
  if (amt > 5_000_000 && amt <= 20_000_000 && hasRevenue) return "Series A";
  if (amt > 20_000_000) return "Series B+";
  return null;
}

/** Likely investor type from exemption + minimum investment. */
export function deriveInvestorType(f: Pick<FormDFiling, "exemptions" | "is506c" | "minInvestment">): string | null {
  const ex = f.exemptions ?? "";
  const isRule504 = /\b04\b/.test(ex);
  const is506b = /06b/i.test(ex);
  if (isRule504) return "Friends and family";
  if (is506b && f.minInvestment != null && f.minInvestment < 100_000) return "Accredited individuals, angels";
  if (f.is506c && f.minInvestment != null && f.minInvestment >= 100_000) return "Family offices, institutions";
  if (f.is506c) return "Accredited, general solicitation";
  return null;
}
