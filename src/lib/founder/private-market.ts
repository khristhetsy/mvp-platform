import type { Company } from "@/lib/supabase/types";
import { companyToMatchProfile, loadApprovedInvestorMatchProfiles } from "@/lib/matching/load-matching-data";
import { matchInvestorToCompany } from "@/lib/matching/investor-company-matching";

export type FounderInvestorRow = {
  symbol: string;
  /** Anonymized descriptor — never an investor's identity. */
  label: string;
  matchScore: number;
  band: "high" | "mid" | "low";
  checkSize: string;
  sectors: string[];
};

export type FounderPrivateMarketSummary = {
  /** Total approved investors on the platform. */
  investorUniverse: number;
  /** Of the shown set, how many are strong fits (match ≥ 75). */
  strongCount: number;
  avgMatch: number | null;
};

function matchBand(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatCheck(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${compact(min)}–$${compact(max)}`;
  if (min != null) return `$${compact(min)}+`;
  if (max != null) return `up to $${compact(max)}`;
  return "—";
}

function tokens(value: unknown): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value.map(String) : String(value).split(/[,;]/);
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

/**
 * Rank approved platform investors by fit to the founder's company. Investor
 * identities are intentionally anonymized — founders see fit + criteria, not
 * contact details. Uses the existing rules-based matching engine (real scores).
 */
export async function loadFounderInvestorBoard(
  company: Company,
  limit = 24,
): Promise<{ rows: FounderInvestorRow[]; summary: FounderPrivateMarketSummary }> {
  const investors = await loadApprovedInvestorMatchProfiles();
  const profile = companyToMatchProfile(company);

  const scored = investors
    .map((investor) => ({ investor, match: matchInvestorToCompany(investor, profile) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, limit);

  const rows: FounderInvestorRow[] = scored.map(({ investor, match }, index) => {
    const sectors = tokens(investor.preferred_sectors);
    const type = investor.investor_type ? String(investor.investor_type) : "Investor";
    const code =
      (investor.profile_id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() ||
      String(index + 1).padStart(4, "0");
    return {
      symbol: `INV·${code}`,
      label: sectors.length ? `${type} · ${sectors.slice(0, 2).join(", ")} focus` : type,
      matchScore: match.matchScore,
      band: matchBand(match.matchScore),
      checkSize: formatCheck(investor.check_size_min ?? null, investor.check_size_max ?? null),
      sectors,
    };
  });

  const shownScores = scored.map((s) => s.match.matchScore);
  const summary: FounderPrivateMarketSummary = {
    investorUniverse: investors.length,
    strongCount: shownScores.filter((s) => s >= 75).length,
    avgMatch: shownScores.length
      ? Math.round((shownScores.reduce((a, b) => a + b, 0) / shownScores.length) * 10) / 10
      : null,
  };

  return { rows, summary };
}
