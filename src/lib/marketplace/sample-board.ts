import type { ScoredBoardRow } from "@/components/marketing/MarketingScoredBoard";

/**
 * Illustrative Private Market board data for the public /deals page.
 * These rows are samples, not live platform data, and every surface that shows
 * them says so. Kept out of the page so the ranking and sector maths are testable.
 */
export type SampleDeal = ScoredBoardRow & {
  /** Share of the target that has been indicated, 0 to 100. */
  indicatedPct: number;
  indicatedAmount: string;
  targetAmount: string;
};

type SampleSeed = {
  symbol: string;
  name: string;
  score: number;
  tags: string[];
  indicatedPct: number;
  indicatedAmount: string;
  targetAmount: string;
};

/** Same bands the board has always used: 80+ strong, 70+ moderate, otherwise building. */
export function bandForScore(score: number): ScoredBoardRow["band"] {
  if (score >= 80) return "high";
  if (score >= 70) return "mid";
  return "low";
}

const SEEDS: SampleSeed[] = [
  { symbol: "FOX·EYES", name: "FoxEyes Vision AI", score: 84.0, tags: ["AI", "Vision"], indicatedPct: 72, indicatedAmount: "$1.8M", targetAmount: "$2.5M" },
  { symbol: "DMND·AI", name: "Diamond AI", score: 80.5, tags: ["AI", "Infra"], indicatedPct: 60, indicatedAmount: "$1.2M", targetAmount: "$2.0M" },
  { symbol: "HEART·SX", name: "HeartScoreX MRI", score: 76.4, tags: ["Health"], indicatedPct: 44, indicatedAmount: "$880K", targetAmount: "$2.0M" },
  { symbol: "VRDE·Ca", name: "Verde Cargo", score: 62.8, tags: ["Climate"], indicatedPct: 18, indicatedAmount: "$270K", targetAmount: "$1.5M" },
];

export const SAMPLE_DEALS: SampleDeal[] = SEEDS.map((s) => ({
  symbol: s.symbol,
  name: s.name,
  score: s.score,
  band: bandForScore(s.score),
  metricMain: `${s.indicatedPct}% indicated`,
  metricSub: `${s.indicatedAmount} / ${s.targetAmount}`,
  tags: s.tags,
  indicatedPct: s.indicatedPct,
  indicatedAmount: s.indicatedAmount,
  targetAmount: s.targetAmount,
}));

export type SectorAverage = { sector: string; avgScore: number; deals: number };

/** Average readiness per sector tag, highest first. A deal counts once in each of its tags. */
export function sectorAverages(deals: readonly SampleDeal[]): SectorAverage[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const d of deals) {
    for (const tag of d.tags) {
      const cur = acc.get(tag) ?? { sum: 0, n: 0 };
      cur.sum += d.score;
      cur.n += 1;
      acc.set(tag, cur);
    }
  }
  return [...acc.entries()]
    .map(([sector, { sum, n }]) => ({ sector, avgScore: Math.round((sum / n) * 10) / 10, deals: n }))
    .sort((a, b) => b.avgScore - a.avgScore || a.sector.localeCompare(b.sector));
}
