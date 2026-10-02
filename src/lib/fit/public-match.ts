/**
 * /fit v2 public results: the matches a founder sees before the Match Review call.
 *
 * Firm names are the reason to book, so they never leave the server in v2. Each
 * result is reduced to an investor type, a sector focus, the stated check size
 * and the fit score. The real names stay in the session's match_snapshot for the
 * team running the call.
 */

import { canonicalInvestorType, type FitAnswers } from "@/lib/fit/options";
import type { MatchResponse, MatchResult } from "@/lib/fit/match-investors";

export type PublicMatch = { key: string; title: string; detail: string; fit: number };
export type PublicMatchResponse = {
  matched_count: number;
  top: PublicMatch[];
  thin: boolean;
  network_total: number;
};

const TYPE_LABEL: Record<string, string> = {
  "Angel": "Angel investor",
  "VC": "Venture fund",
  "Private Equity": "Private equity firm",
  "Family Office": "Family office",
  "Corporate Venture": "Corporate investor",
  "Accelerator": "Accelerator",
};

function typeLabel(types: string[]): string {
  for (const t of types) {
    const canon = canonicalInvestorType(t);
    if (canon && TYPE_LABEL[canon]) return TYPE_LABEL[canon];
  }
  return "Investor";
}

/** The investor's sector that overlaps the founder's selection, else its first. */
function focus(sectors: string[], answers: FitAnswers): string | null {
  const wanted = new Set(answers.industry.map((s) => s.trim().toLowerCase()));
  return sectors.find((s) => wanted.has(s.trim().toLowerCase())) ?? sectors[0] ?? null;
}

export function toPublicMatch(m: MatchResult, answers: FitAnswers, index: number): PublicMatch {
  const f = focus(m.sectors, answers);
  const title = f ? `${typeLabel(m.types)}, ${f} focus` : typeLabel(m.types);
  const detail = [m.checkSize ? `Checks ${m.checkSize}` : null, m.stage].filter(Boolean).join(" · ");
  return { key: `m${index + 1}`, title, detail, fit: m.fit };
}

export function toPublicResponse(r: MatchResponse, answers: FitAnswers): PublicMatchResponse {
  return {
    matched_count: r.matched_count,
    top: r.top.map((m, i) => toPublicMatch(m, answers, i)),
    thin: r.matched_count === 0,
    network_total: r.network_total,
  };
}
