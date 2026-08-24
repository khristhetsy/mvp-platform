// Form D lead scoring (build spec §6). Six components, raw sum, normalized against
// a maximum of 110 (the real component ceiling), floored at 0. Weights are priors,
// not evidence — retune against closed outcomes after a quarter. Every component
// appends a human-readable line to score_notes; the two derived fields are stamped
// as DERIVED so nobody mistakes them for founder-stated values.

import { deriveFundingStage, deriveInvestorType } from "./derive";
import type { FormDFiling } from "./types";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export type FormDScore = {
  score: number;
  notes: string;
  fundingStage: string | null;
  investorType: string | null;
};

export function scoreFormD(f: FormDFiling): FormDScore {
  const notes: string[] = [];
  let raw = 0;

  // 1 — remaining raise (max 30)
  const rem = f.totalRemaining;
  let c1 = 0;
  if (rem != null) {
    if (rem >= 5_000_000 && rem <= 25_000_000) c1 = 30;
    else if (rem > 25_000_000) c1 = 22;
    else if (rem >= 1_000_000) c1 = 24;
    else if (rem >= 250_000) c1 = 12;
  }
  raw += c1;
  notes.push(`Remaining raise: ${c1}/30 (${rem == null ? "n/a" : usd(rem)})`);

  // 2 — staleness (max 30)
  let c2: number;
  let staleLabel: string;
  if (f.saleYetToOccur) { c2 = 10; staleLabel = "no sale yet"; }
  else if (f.daysSinceFirstSale == null) { c2 = 10; staleLabel = "no first-sale date"; }
  else {
    const d = f.daysSinceFirstSale;
    if (d < 45) c2 = 8;
    else if (d < 90) c2 = 18;
    else if (d <= 365) c2 = 30;
    else if (d <= 550) c2 = 20;
    else c2 = 5;
    staleLabel = `${d}d`;
  }
  raw += c2;
  notes.push(`Staleness: ${c2}/30 (${staleLabel})`);

  // 3 — traction (max 15)
  const p = f.pctSold;
  let c3: number;
  if (p == null) c3 = 8;
  else if (p > 85) c3 = 0;
  else if (p >= 60) c3 = 6;
  else if (p >= 5) c3 = 15;
  else c3 = 8;
  raw += c3;
  notes.push(`Traction: ${c3}/15 (${p == null ? "n/a" : `${p}% sold`})`);

  // 4 — company type (max 15): operating +10, revenue +5, fund −10
  let c4 = f.isFund ? -10 : 10;
  if (f.revenueRange) c4 += 5;
  raw += c4;
  notes.push(`Company type: ${signed(c4)}/15 (${f.isFund ? "fund" : "operating"}${f.revenueRange ? ", revenue disclosed" : ""})`);

  // 5 — competition (max 10): no agent +10, agent named −12
  const c5 = f.hasPlacementAgent ? -12 : 10;
  raw += c5;
  notes.push(`Competition: ${signed(c5)}/10 (${f.hasPlacementAgent ? "agent named" : "no agent"})`);

  // 6 — reachability (max 10): phone +4, 2+ principals +3, 506(c) +3
  let c6 = 0;
  const bits: string[] = [];
  if (f.phone) { c6 += 4; bits.push("phone"); }
  if (f.relatedPersons.length >= 2) { c6 += 3; bits.push("2+ principals"); }
  if (f.is506c) { c6 += 3; bits.push("506(c)"); }
  raw += c6;
  notes.push(`Reachability: +${c6}/10 (${bits.join(", ") || "—"})`);

  const score = Math.max(0, Math.round((raw / 110) * 100));

  const fundingStage = deriveFundingStage(f);
  const investorType = deriveInvestorType(f);
  notes.push(`DERIVED funding stage: ${fundingStage ?? "—"}`);
  notes.push(`DERIVED investor type: ${investorType ?? "—"}`);

  return { score, notes: notes.join("\n"), fundingStage, investorType };
}
