/**
 * The onboarding meter: how many of the matching engine's points a profile can
 * earn, given what has been answered so far.
 *
 * Pure, so a client component can run it on every keystroke. The weights are
 * the engine's own (admin match settings, passed down from the server), which
 * is what makes the meter honest: a point shown here is a point the matcher
 * scores. Fields a person reads, such as the thesis or the description, are not
 * listed because the matcher does not score them.
 *
 * Active rating is left out on purpose. It is computed from an investor's
 * activity, not asked, so no answer can move it.
 */
import type { EngineWeights } from "@/lib/matching/investor-company-matching";

export type MeterRow = { label: string; weight: number; answered: boolean };
export type Meter = { rows: MeterRow[]; answeredPoints: number; totalPoints: number };

function meter(rows: MeterRow[]): Meter {
  return {
    rows,
    answeredPoints: rows.reduce((n, r) => n + (r.answered ? r.weight : 0), 0),
    totalPoints: rows.reduce((n, r) => n + r.weight, 0),
  };
}

const has = (v: string | null | undefined) => Boolean(v && v.trim());
const any = (v: readonly string[] | null | undefined) => Boolean(v && v.some((x) => x.trim()));

export type FounderMeterInput = {
  industry: string | null;
  /** Funding, operating and revenue stage all feed the core's stage factor. */
  stages: string[];
  amountBand: string | null;
  country: string | null;
  state: string | null;
  seekingInvestorTypes: string[];
  seekingCapitalTypes: string[];
  arr: string | null;
  mrr: string | null;
};

export function founderMeter(input: FounderMeterInput, w: EngineWeights): Meter {
  return meter([
    { label: "Industry", weight: w.sector, answered: has(input.industry) },
    { label: "Stage", weight: w.stage, answered: any(input.stages) },
    { label: "Amount of capital", weight: w.checkSize, answered: has(input.amountBand) },
    { label: "Headquarters location", weight: w.geography, answered: has(input.country) || has(input.state) },
    { label: "Seeking investor type", weight: w.investorType, answered: any(input.seekingInvestorTypes) },
    { label: "Seeking capital type", weight: w.capitalType, answered: any(input.seekingCapitalTypes) },
    { label: "ARR", weight: w.arr, answered: has(input.arr) },
    { label: "MRR", weight: w.mrr, answered: has(input.mrr) },
  ]);
}

export type InvestorMeterInput = {
  sectors: string[];
  stages: string[];
  checkSizeMin: string | number | null;
  checkSizeMax: string | number | null;
  geographies: string[];
  investorType: string | null;
  capitalTypes: string[];
  arrBands: string[];
  mrrBands: string[];
};

export function investorMeter(input: InvestorMeterInput, w: EngineWeights): Meter {
  const size = (v: string | number | null) => v !== null && String(v).trim() !== "";
  return meter([
    { label: "Industry", weight: w.sector, answered: any(input.sectors) },
    { label: "Stage preference", weight: w.stage, answered: any(input.stages) },
    { label: "Typical check size", weight: w.checkSize, answered: size(input.checkSizeMin) || size(input.checkSizeMax) },
    { label: "Geographies", weight: w.geography, answered: any(input.geographies) },
    { label: "Investor type", weight: w.investorType, answered: has(input.investorType) },
    { label: "Capital type", weight: w.capitalType, answered: any(input.capitalTypes) },
    { label: "Preferred ARR range", weight: w.arr, answered: any(input.arrBands) },
    { label: "Preferred MRR range", weight: w.mrr, answered: any(input.mrrBands) },
  ]);
}
