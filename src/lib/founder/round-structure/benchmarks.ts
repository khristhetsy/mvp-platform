// The sourced benchmark library behind the AI offering analysis.
//
// Every figure the report shows comes from this file, never from model memory.
// Each one names the population it describes and the source it was read from.
// Add or change a figure only from a published page, and move its `asOf` date.
// "secondary" means the figure was read in a summary that cites the publisher,
// and the report says so. Where no dataset exists (warrant coverage) the entry
// is null on purpose: the report says "no dataset" instead of estimating.

export type BenchmarkSource = {
  id: number;
  title: string;
  detail: string;
  url: string;
  access: "primary" | "secondary";
};

export const BENCHMARK_AS_OF = "October 26, 2026";

export const BENCHMARK_SOURCES: BenchmarkSource[] = [
  { id: 1, title: "PitchBook NVCA Venture Monitor, Q1 2026", detail: "US seed median pre-money $18.4M and median seed deal value $3.0M. All US sectors.", url: "https://hub.causo.ai/guides/seed-round-valuation-benchmark-2026", access: "secondary" },
  { id: 2, title: "Carta, VC Startup Fundraising Benchmarks From 1,000 Rounds", detail: "US software companies, priced rounds closed in the six months to July 2026. Median seed post-money $24.3M, median raise $4.1M, median dilution 18%.", url: "https://waveup.com/blog/seed-round-benchmarks/", access: "secondary" },
  { id: 3, title: "Carta, State of Pre-Seed Q2 2026 and SAFE valuation caps", detail: "Published August 25, 2026. 93% of pre-seed rounds were SAFEs and 91% of SAFEs were post-money.", url: "https://carta.com/data/safe-valuation-caps-q2-2026/", access: "primary" },
  { id: 4, title: "CRV, Equity dilution guide", detail: "Early stage option pools commonly 10 to 15%. Investors typically require the pool before the investment closes.", url: "https://www.crv.com/content/equity-dilution", access: "primary" },
  { id: 5, title: "Cooley, Q1 2026 Venture Financing Report", detail: "Published April 29, 2026. 165 reported financings. 98.2% had a 1x preference, 96.4% nonparticipating, 86% up rounds, 11.4% down rounds.", url: "https://cooley.com/news/insight/2026/2026-04-29-q1-2026-venture-financing-report", access: "primary" },
  { id: 6, title: "Carta, founding team ownership after each round", detail: "Median founding team ownership 55.1% after seed. 3,500+ US startups that raised venture rounds in the past 18 months, no deep tech.", url: "https://carta.com/data/linkedin-founders-rarely-majority-after-series-a/", access: "primary" },
  { id: 7, title: "Carta, SAFE share by stage, Q1 2025", detail: "90% of pre-seed deals and 64% of seed deals used a SAFE.", url: "https://blog.mean.ceo/?p=11240", access: "secondary" },
  { id: 8, title: "Carta, SAFE terms trends for pre-seed and seed founders", detail: "When there is a discount it is typically 20%, for SAFEs or notes.", url: "https://carta.com/data/linkedin-safe-terms-trends-primer-founders/", access: "primary" },
  { id: 9, title: "Carta State of Pre-Seed, read through Peony", detail: "H1 2026: 94% of post-money SAFEs had a cap, 73% cap only, 21% cap plus discount. Notes were 7% of pre-seed rounds in Q1 2026. Median note interest 7% in Q1 2025, the latest figure verified.", url: "https://www.peony.ink/blog/safe-vs-convertible-note", access: "secondary" },
  { id: 10, title: "WilmerHale, Giving Away the Farm with SAFEs", detail: "April 14, 2026. Discount tends to fall between 10% and 30%. Sets out the discount against cap formulas.", url: "https://www.wilmerhale.com/en/insights/publications/20260414-giving-away-the-farm-with-safes", access: "primary" },
  { id: 11, title: "Angel Capital Association, Model Convertible Note v1.2", detail: "November 2024. Discount range 10% to 30% typical, 20% average per Carta Q1 2024. Maturity 12 months to 3 years typical.", url: "https://angelcapitalassociation.org/wp-content/uploads/2024/12/ACA-Model-Convertible-Promissory-Note-version-1.2-11_24163748628.4-C.docx", access: "primary" },
  { id: 12, title: "Crunchbase News, The Case For The Uncapped SAFE", detail: "Carta 2024 data on 8,762 SAFEs: 61% cap only, 30% cap plus discount, 8% discount only, 1% neither. Quotes the Y Combinator template note.", url: "https://news.crunchbase.com/startups/uncapped-safe-case-gray-equidam", access: "primary" },
  { id: 13, title: "Startup Company Lawyer, bridge loan warrant coverage", detail: "Posted 2007. Warrant coverage is a percent of principal, often near the 20% to 40% discount range. No current dataset.", url: "https://www.startupcompanylawyer.com/2007/05/03/what-should-the-terms-of-bridge-loan-warrant-coverage-be/", access: "secondary" },
];

export const BENCHMARKS = {
  seedPreMoneyMedian: { value: 18_400_000, source: 1, population: "US seed rounds, all sectors, Q1 2026 median pre-money." },
  seedPostMoneyMedian: { value: 24_300_000, source: 2, population: "US software companies, priced seed rounds closed in the six months to July 2026." },
  seedDealMedianAll: { value: 3_000_000, source: 1, population: "US seed deals, all sectors, Q1 2026 median deal value." },
  seedRaiseMedianSoftware: { value: 4_100_000, source: 2, population: "US software companies, priced seed rounds, six months to July 2026." },
  seedDilutionMedianPct: { value: 18, source: 2, population: "US software companies, median seed dilution, six months to July 2026." },
  poolRangePct: { low: 10, high: 15, source: 4, population: "Early stage option pools as commonly seen, per CRV." },
  discountTypicalPct: { value: 20, source: 8, population: "US SAFEs and notes with a discount, on Carta. When a discount is present it is typically 20%." },
  discountRangePct: { low: 10, high: 30, source: 10, population: "Range stated in law firm guidance on SAFEs." },
  postMoneyShareOfSafesPct: { value: 91, source: 3, population: "SAFEs on Carta, Q2 2026." },
  safeCapOnlyPct: { value: 73, source: 9, population: "Post-money SAFEs on Carta, first half of 2026." },
  safeCapPlusDiscountPct: { value: 21, source: 9, population: "Post-money SAFEs on Carta, first half of 2026." },
  noteInterestMedianPct: { value: 7, source: 9, population: "Median note interest rate on Carta, Q1 2025, the latest figure verified." },
  noteDiscountAveragePct: { value: 20, source: 11, population: "Average note discount for the year to Q1 2024 on Carta. Typical range 10% to 30%." },
  noteMaturityRangeMonths: { low: 12, high: 36, source: 11, population: "Range stated in the model convertible note, version 1.2, November 2024." },
  noteShareOfPreSeedPct: { value: 7, source: 9, population: "US pre-seed rounds on Carta, Q1 2026, a record low." },
  safeShareOfPreSeedPct: { value: 93, source: 3, population: "US pre-seed rounds on Carta, Q2 2026." },
  safeShareOfSeedPct: { value: 64, source: 7, population: "Seed deals on Carta, Q1 2025." },
  foundingTeamOwnershipAfterSeedPct: { value: 55.1, source: 6, population: "Median founding team after a seed round closes, 3,500+ US startups, no deep tech." },
  // No institutional dataset exists. The report shows this as "no dataset".
  warrantCoverage: null,
} as const;

export function sourceById(id: number): BenchmarkSource | undefined {
  return BENCHMARK_SOURCES.find((s) => s.id === id);
}
