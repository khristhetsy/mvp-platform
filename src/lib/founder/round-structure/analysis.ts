// The AI offering analysis, computed from the sourced benchmark library.
// Pure and deterministic: every number and every status comes from the founder's
// inputs and benchmarks.ts. The AI route only turns these facts into plain words,
// and any figure it writes that is not in `allowedFigures` is thrown away.

import { BENCHMARKS, BENCHMARK_AS_OF, BENCHMARK_SOURCES, type BenchmarkSource } from "./benchmarks";
import { computeRound, fmtMoney, fmtMoney2, type RoundInputs, type RoundResult } from "./model";

export type Tone = "near" | "above" | "context";

export type AnalysisRow = {
  key: string;
  label: string;
  statusLabel: string;
  tone: Tone;
  you: string;
  /** Null when there is nothing to compare against (no dataset). */
  bench: string | null;
  yourValue: number | null;
  benchValue: number | null;
  delta: string;
  population: string;
  sourceId: number | null;
};

export type Finding = {
  key: string;
  title: string;
  tag: string;
  tone: Tone;
  data: string;
  means: string;
  nextLabel: string;
  next: string;
  sourceIds: number[];
};

export type OfferingAnalysis = {
  asOf: string;
  inputsSummary: string[];
  ownership: { investors: number; pool: number; existing: number };
  chain: string[];
  rows: AnalysisRow[];
  findings: Finding[];
  sources: BenchmarkSource[];
  /** Every figure written in rows and findings. The AI summary may use these and nothing else. */
  allowedFigures: string[];
};

const B = BENCHMARKS;
const IN_LINE_BAND_PCT = 10;

const pct1 = (n: number) => `${n.toFixed(1)}%`;
const sign = (n: number) => (n >= 0 ? "+" : "-");

/** "+7.6% vs median" for money rows, relative to the benchmark. */
function relDelta(you: number, bench: number, noun: string): { text: string; rel: number } {
  const rel = ((you - bench) / bench) * 100;
  return { text: `${sign(rel)}${Math.abs(rel).toFixed(1)}% vs ${noun}`, rel };
}

/** "+0.9 points vs median" for rate rows. */
function pointsDelta(you: number, bench: number, noun: string): string {
  const d = you - bench;
  return d === 0 ? `0.0 points vs ${noun}` : `${sign(d)}${Math.abs(d).toFixed(1)} points vs ${noun}`;
}

function moneyRow(key: string, label: string, you: number, bench: number, noun: string, population: string, sourceId: number): AnalysisRow {
  const { text, rel } = relDelta(you, bench, noun);
  const inLine = Math.abs(rel) <= IN_LINE_BAND_PCT;
  return {
    key, label, you: fmtMoney(you), bench: fmtMoney(bench), yourValue: you, benchValue: bench, delta: text, population, sourceId,
    statusLabel: inLine ? "In line" : rel > 0 ? "Above median" : "Below median",
    tone: inLine ? "near" : "above",
  };
}

export function analyzeOffering(inputs: RoundInputs, resultIn?: RoundResult): OfferingAnalysis {
  const r = resultIn ?? computeRound(inputs);
  const isSafe = inputs.roundType === "safe";
  const isNote = inputs.roundType === "note";
  const hasDiscount = !inputs.roundType.startsWith("priced") && inputs.discountPct > 0;
  const rows: AnalysisRow[] = [];

  rows.push(moneyRow("pre", isNote ? "Valuation cap" : "Pre-money valuation", inputs.preMoney, B.seedPreMoneyMedian.value, "median", B.seedPreMoneyMedian.population, B.seedPreMoneyMedian.source));
  rows.push(moneyRow("post", "Post-money valuation", r.postMoney, B.seedPostMoneyMedian.value, "median", B.seedPostMoneyMedian.population, B.seedPostMoneyMedian.source));
  rows.push(moneyRow("raise_all", "Raise amount, all sectors", inputs.raiseAmount, B.seedDealMedianAll.value, "median", B.seedDealMedianAll.population, B.seedDealMedianAll.source));
  rows.push(moneyRow("raise_sw", "Raise amount, software", inputs.raiseAmount, B.seedRaiseMedianSoftware.value, "median", B.seedRaiseMedianSoftware.population, B.seedRaiseMedianSoftware.source));

  const sold = r.newInvestorPct;
  const soldInLine = Math.abs(sold - B.seedDilutionMedianPct.value) <= 2;
  rows.push({
    key: "sold", label: "Equity sold to investors", you: pct1(sold), bench: `${B.seedDilutionMedianPct.value}%`,
    yourValue: sold, benchValue: B.seedDilutionMedianPct.value,
    delta: pointsDelta(sold, B.seedDilutionMedianPct.value, "median"), population: B.seedDilutionMedianPct.population, sourceId: B.seedDilutionMedianPct.source,
    statusLabel: soldInLine ? "In line" : sold > B.seedDilutionMedianPct.value ? "Above median" : "Below median", tone: soldInLine ? "near" : "above",
  });

  const pool = inputs.optionPoolPct;
  const poolStatus = pool > B.poolRangePct.high ? "Above range" : pool < B.poolRangePct.low ? "Below range" : "In range";
  rows.push({
    key: "pool", label: "Option pool", you: pct1(pool), bench: `${B.poolRangePct.low} to ${B.poolRangePct.high}%`,
    yourValue: pool, benchValue: B.poolRangePct.high,
    delta: pool > B.poolRangePct.high ? `+${(pool - B.poolRangePct.high).toFixed(1)} points above the top of the range`
      : pool < B.poolRangePct.low ? `${(B.poolRangePct.low - pool).toFixed(1)} points below the bottom of the range` : "Inside the range",
    population: B.poolRangePct.population, sourceId: B.poolRangePct.source,
    statusLabel: poolStatus, tone: poolStatus === "In range" ? "near" : "above",
  });

  if (isSafe) {
    if (hasDiscount) {
      rows.push({
        key: "discount_typical", label: "Discount rate", you: `${inputs.discountPct}%`, bench: `${B.discountTypicalPct.value}%`,
        yourValue: inputs.discountPct, benchValue: B.discountTypicalPct.value,
        delta: pointsDelta(inputs.discountPct, B.discountTypicalPct.value, "typical"), population: B.discountTypicalPct.population, sourceId: B.discountTypicalPct.source,
        statusLabel: inputs.discountPct === B.discountTypicalPct.value ? "In line" : "Differs from typical", tone: inputs.discountPct === B.discountTypicalPct.value ? "near" : "above",
      });
      const inRange = inputs.discountPct >= B.discountRangePct.low && inputs.discountPct <= B.discountRangePct.high;
      rows.push({
        key: "discount_range", label: "Discount inside the common range", you: `${inputs.discountPct}%`, bench: `${B.discountRangePct.low} to ${B.discountRangePct.high}%`,
        yourValue: inputs.discountPct, benchValue: B.discountRangePct.high,
        delta: inRange ? "Inside the range" : "Outside the range", population: B.discountRangePct.population, sourceId: B.discountRangePct.source,
        statusLabel: inRange ? "In range" : "Outside range", tone: inRange ? "near" : "above",
      });
      rows.push({
        key: "structure", label: "Cap plus discount structure", you: "Cap plus discount", bench: `${B.safeCapPlusDiscountPct.value}% of post-money SAFEs`,
        yourValue: null, benchValue: null,
        delta: `${B.safeCapPlusDiscountPct.value}% use this structure, ${B.safeCapOnlyPct.value}% are cap only`, population: B.safeCapPlusDiscountPct.population, sourceId: B.safeCapPlusDiscountPct.source,
        statusLabel: "Less common", tone: "above",
      });
    } else {
      rows.push({
        key: "structure", label: "Cap only structure", you: "Cap only", bench: `${B.safeCapOnlyPct.value}% of post-money SAFEs`,
        yourValue: null, benchValue: null,
        delta: `${B.safeCapOnlyPct.value}% are cap only, ${B.safeCapPlusDiscountPct.value}% add a discount`, population: B.safeCapOnlyPct.population, sourceId: B.safeCapOnlyPct.source,
        statusLabel: "Most common", tone: "near",
      });
    }
  }

  if (isNote) {
    rows.push({
      key: "instrument", label: "Instrument share", you: "Convertible note", bench: `${B.noteShareOfPreSeedPct.value}% of pre-seed rounds`,
      yourValue: null, benchValue: null,
      delta: `Notes were ${B.noteShareOfPreSeedPct.value}% of pre-seed rounds, a record low, and SAFEs ${B.safeShareOfPreSeedPct.value}%`,
      population: B.noteShareOfPreSeedPct.population, sourceId: B.noteShareOfPreSeedPct.source, statusLabel: "Uncommon", tone: "above",
    });
    rows.push({
      key: "interest", label: "Interest rate", you: `${inputs.interestPct}%`, bench: `${B.noteInterestMedianPct.value}%`,
      yourValue: inputs.interestPct, benchValue: B.noteInterestMedianPct.value,
      delta: pointsDelta(inputs.interestPct, B.noteInterestMedianPct.value, "median"), population: B.noteInterestMedianPct.population, sourceId: B.noteInterestMedianPct.source,
      statusLabel: Math.abs(inputs.interestPct - B.noteInterestMedianPct.value) <= 1 ? "In line" : inputs.interestPct > B.noteInterestMedianPct.value ? "Above median" : "Below median",
      tone: Math.abs(inputs.interestPct - B.noteInterestMedianPct.value) <= 1 ? "near" : "above",
    });
    if (hasDiscount) {
      rows.push({
        key: "note_discount", label: "Discount", you: `${inputs.discountPct}%`, bench: `${B.noteDiscountAveragePct.value}%`,
        yourValue: inputs.discountPct, benchValue: B.noteDiscountAveragePct.value,
        delta: pointsDelta(inputs.discountPct, B.noteDiscountAveragePct.value, "average"), population: B.noteDiscountAveragePct.population, sourceId: B.noteDiscountAveragePct.source,
        statusLabel: inputs.discountPct === B.noteDiscountAveragePct.value ? "In line" : "Differs from average", tone: inputs.discountPct === B.noteDiscountAveragePct.value ? "near" : "above",
      });
    }
    const inM = inputs.maturityMonths >= B.noteMaturityRangeMonths.low && inputs.maturityMonths <= B.noteMaturityRangeMonths.high;
    rows.push({
      key: "maturity", label: "Maturity", you: `${inputs.maturityMonths} months`, bench: `${B.noteMaturityRangeMonths.low} to ${B.noteMaturityRangeMonths.high} months`,
      yourValue: inputs.maturityMonths, benchValue: B.noteMaturityRangeMonths.high,
      delta: inM ? "Inside the typical range of 12 months to 3 years" : "Outside the typical range of 12 months to 3 years",
      population: B.noteMaturityRangeMonths.population, sourceId: B.noteMaturityRangeMonths.source, statusLabel: inM ? "In range" : "Outside range", tone: inM ? "near" : "above",
    });
    if (inputs.warrantPct > 0) {
      rows.push({
        key: "warrant", label: "Warrant coverage", you: `${inputs.warrantPct}%`, bench: null, yourValue: null, benchValue: null,
        delta: "No current institutional benchmark found. One practitioner source dated 2007 puts coverage near the 20% to 40% discount range.",
        population: "Reference only, not a market median.", sourceId: 13, statusLabel: "No dataset", tone: "context",
      });
    }
  }

  const findings: Finding[] = [];
  const own = { investors: r.newInvestorPct, pool: r.poolPct, existing: r.existingPct };

  if (pool > B.poolRangePct.high) {
    findings.push({
      key: "pool", title: "Option pool is above the common range", tag: "Review", tone: "above",
      data: `Your pool input is ${pct1(pool)}. CRV reports early stage pools commonly land at ${B.poolRangePct.low} to ${B.poolRangePct.high}%, and that investors typically require the pool before the investment closes.`,
      means: `The pool is created before the new money, so existing holders carry the cost. In this model the pool ends at ${pct1(own.pool)} after the round and existing holders keep ${pct1(own.existing)}.`,
      nextLabel: "Suggested check", next: "Tie the pool size to a written hiring plan before agreeing to the number.", sourceIds: [4],
    });
  }
  const aboveBoth = inputs.raiseAmount > B.seedDealMedianAll.value * 1.1 && inputs.raiseAmount > B.seedRaiseMedianSoftware.value * 1.1;
  if (aboveBoth) {
    findings.push({
      key: "raise", title: "Round size is above the median", tag: "Review", tone: "above",
      data: `${fmtMoney(inputs.raiseAmount)} is ${relDelta(inputs.raiseAmount, B.seedDealMedianAll.value, "median").text.replace(" vs median", "")} above the ${fmtMoney(B.seedDealMedianAll.value)} US seed median (PitchBook NVCA) and ${relDelta(inputs.raiseAmount, B.seedRaiseMedianSoftware.value, "median").text.replace(" vs median", "")} above the ${fmtMoney(B.seedRaiseMedianSoftware.value)} software median (Carta).`,
      means: "The round sits in the upper part of seed sizes, so investors will measure it against a higher median in software.",
      nextLabel: "Suggested check", next: "Prepare a clear use of funds that shows what the extra capital buys.", sourceIds: [1, 2],
    });
  }
  if (isSafe) {
    findings.push({
      key: "instrument", title: "Instrument matches market practice", tag: "Context", tone: "context",
      data: `${B.postMoneyShareOfSafesPct.value}% of SAFEs on Carta in Q2 2026 were post-money, and ${B.safeShareOfPreSeedPct.value}% of pre-seed rounds used SAFEs. At seed, ${B.safeShareOfSeedPct.value}% of deals used a SAFE in Q1 2025.`,
      means: `A SAFE is the common choice. At seed, 100 − ${B.safeShareOfSeedPct.value} = ${100 - B.safeShareOfSeedPct.value}% of deals used another instrument, so a priced round is a normal alternative at ${fmtMoney(inputs.raiseAmount)}.`,
      nextLabel: "Compare", next: "Switch to Priced round on the same inputs to see the difference in ownership.", sourceIds: [3, 7],
    });
    if (hasDiscount && r.discountBreakEvenPreMoney) {
      findings.push({
        key: "safe_discount", title: "Cap plus discount favors the investor", tag: "Context", tone: "context",
        data: `Y Combinator dropped its cap plus discount template in 2021 and recommends one or the other (Crunchbase News). WilmerHale notes the investor takes the more favorable of the two.`,
        means: `${fmtMoney(inputs.preMoney)} ÷ ${100 - inputs.discountPct}% = ${fmtMoney(r.discountBreakEvenPreMoney)}. At that next round pre-money the two terms are equal. Below it the discount wins.`,
        nextLabel: "Suggested check", next: "Confirm which form the investor expects and model your next round at three pre-money values.", sourceIds: [10, 12],
      });
    }
  }
  if (isNote) {
    findings.push({
      key: "note_cost", title: "Cost of the note terms", tag: "Context", tone: "context",
      data: `${fmtMoney(inputs.raiseAmount)} × ${inputs.interestPct}% × ${inputs.maturityMonths / 12} years = ${fmtMoney(r.interestAmount)} of simple interest, so ${fmtMoney2(r.convertingAmount)} converts.${inputs.warrantPct > 0 ? ` Warrants at ${inputs.warrantPct}% coverage add ${fmtMoney(r.warrantValue)} of shares at the next round price.` : ""}`,
      means: `At ${inputs.maturityMonths} months the note must convert, be repaid or be extended.`,
      nextLabel: "Suggested check", next: "Confirm what happens at maturity if no priced round has closed.", sourceIds: [11],
    });
  }
  const valuesNear = rows.find((x) => x.key === "pre")?.tone === "near" && rows.find((x) => x.key === "post")?.tone === "near";
  if (valuesNear) {
    findings.push({
      key: "valuation", title: "Valuation is in line with both datasets", tag: "In line", tone: "near",
      data: `${rows.find((x) => x.key === "pre")!.delta} on pre-money (PitchBook NVCA). ${rows.find((x) => x.key === "post")!.delta} on post-money (Carta).`,
      means: "The valuation does not stand out on either dataset. The two datasets cover different populations, so a gap between them is expected.",
      nextLabel: "Note", next: "Sector and location can move the median. This report uses all sectors and US software.", sourceIds: [1, 2],
    });
  }

  const simpleDivision = inputs.roundType === "priced" || (isSafe && inputs.safeType === "post_money");
  const ownershipChain = [
    simpleDivision
      ? `${fmtMoney2(inputs.raiseAmount)} ÷ ${fmtMoney(r.postMoney)} post-money gives investors ${pct1(own.investors)} after the round.`
      : `Investors convert at the cap price${isNote ? `, ${fmtMoney2(r.convertingAmount)} including interest` : ""}, which gives them ${pct1(own.investors)} after the round.`,
    `The pool is ${pct1(inputs.optionPoolPct)} of the shares before the investors arrive, so it ends at ${pct1(own.pool)} once their shares are added.`,
    `100 − ${own.investors.toFixed(1)} − ${own.pool.toFixed(1)} = ${own.existing.toFixed(1)}% belongs to everyone who held shares before the round.`,
    `Reference point: the median founding team holds ${B.foundingTeamOwnershipAfterSeedPct.value}% after seed (Carta). Existing holders include more than founders, so founders alone hold less than ${pct1(own.existing)}.`,
  ];

  const usedIds = new Set<number>();
  rows.forEach((x) => x.sourceId && usedIds.add(x.sourceId));
  findings.forEach((f) => f.sourceIds.forEach((id) => usedIds.add(id)));
  usedIds.add(B.foundingTeamOwnershipAfterSeedPct.source);

  const summary = [
    isSafe ? "SAFE" : isNote ? "Convertible note" : "Priced round",
    isSafe ? (inputs.safeType === "post_money" ? "Post-money cap" : "Pre-money cap") : null,
    `${fmtMoney(inputs.preMoney)} ${isNote || isSafe ? "cap" : "pre-money"}`,
    `${fmtMoney(inputs.raiseAmount)} raise`,
    `${inputs.optionPoolPct}% pool`,
    hasDiscount ? `${inputs.discountPct}% discount` : null,
    isNote ? `${inputs.interestPct}% interest` : null,
    isNote ? `${inputs.maturityMonths} months` : null,
    isNote && inputs.warrantPct > 0 ? `${inputs.warrantPct}% warrants` : null,
  ].filter((x): x is string => Boolean(x));

  const figures = new Set<string>();
  const grab = (t: string) => (t.match(/\d[\d,]*\.?\d*/g) ?? []).forEach((n) => figures.add(n.replace(/,/g, "")));
  rows.forEach((x) => [x.you, x.bench ?? "", x.delta, x.population].forEach(grab));
  findings.forEach((f) => [f.data, f.means, f.next].forEach(grab));
  ownershipChain.forEach(grab);
  summary.forEach(grab);

  return {
    asOf: BENCHMARK_AS_OF,
    inputsSummary: summary,
    ownership: own,
    chain: ownershipChain,
    rows,
    findings,
    sources: BENCHMARK_SOURCES.filter((s) => usedIds.has(s.id)),
    allowedFigures: [...figures],
  };
}

/**
 * True when every number in the AI's text is one the analysis already contains.
 * A summary with any other figure is dropped, so the AI can explain but never add a statistic.
 */
export function summaryUsesOnlyKnownFigures(text: string, allowed: string[]): boolean {
  const ok = new Set(allowed);
  const nums = (text.match(/\d[\d,]*\.?\d*/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
  return nums.every((n) => ok.has(n));
}
