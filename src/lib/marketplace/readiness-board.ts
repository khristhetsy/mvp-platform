/**
 * Aggregate readiness board for the public /deals page.
 *
 * Only band level aggregates leave this module: no company names and no
 * individual scores. Input is one latest score per founder company.
 */

export type ReadinessBandKey = "strong" | "moderate" | "building";

export type ReadinessBand = {
  key: ReadinessBandKey;
  label: string;
  range: string;
  founders: number;
  /** Share of scored founders, 0 to 100, rounded to a whole percent. */
  sharePct: number;
  /** Average score in the band, one decimal, or null when the band is empty. */
  avgScore: number | null;
};

export type ReadinessBoard = {
  scoredFounders: number;
  avgScore: number | null;
  bands: ReadinessBand[];
};

const BAND_DEFS: ReadonlyArray<{
  key: ReadinessBandKey;
  label: string;
  range: string;
  test: (score: number) => boolean;
}> = [
  { key: "strong", label: "Strong", range: "70 and above", test: (s) => s >= 70 },
  { key: "moderate", label: "Moderate", range: "40 to 69", test: (s) => s >= 40 && s < 70 },
  { key: "building", label: "Building", range: "Under 40", test: (s) => s < 40 },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildReadinessBoard(scores: ReadonlyArray<number>): ReadinessBoard {
  const valid = scores.filter((s) => Number.isFinite(s));
  const total = valid.length;

  const bands = BAND_DEFS.map((def): ReadinessBand => {
    const inBand = valid.filter(def.test);
    return {
      key: def.key,
      label: def.label,
      range: def.range,
      founders: inBand.length,
      sharePct: total === 0 ? 0 : Math.round((inBand.length / total) * 100),
      avgScore: inBand.length === 0 ? null : round1(inBand.reduce((a, b) => a + b, 0) / inBand.length),
    };
  });

  return {
    scoredFounders: total,
    avgScore: total === 0 ? null : round1(valid.reduce((a, b) => a + b, 0) / total),
    bands,
  };
}

/** Keeps the newest score per company. Rows may arrive in any order. */
export function latestScorePerCompany(
  rows: ReadonlyArray<{ company_id: string; created_at: string; score: number | null }>,
): number[] {
  const newest = new Map<string, { created_at: string; score: number | null }>();
  for (const row of rows) {
    const seen = newest.get(row.company_id);
    if (!seen || row.created_at > seen.created_at) newest.set(row.company_id, row);
  }
  return [...newest.values()].flatMap((r) => (typeof r.score === "number" ? [r.score] : []));
}
