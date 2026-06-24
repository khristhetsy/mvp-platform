import type { Company } from "@/lib/supabase/types";
import { companyToMatchProfile, loadApprovedInvestorMatchProfiles } from "@/lib/matching/load-matching-data";
import { matchInvestorToCompany } from "@/lib/matching/investor-company-matching";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type InvestorMomentum = "active" | "warm" | "quiet";

export type FounderInvestorRow = {
  symbol: string;
  /** Anonymized descriptor — never an investor's identity. */
  label: string;
  matchScore: number;
  band: "high" | "mid" | "low";
  checkSize: string;
  sectors: string[];
  /** Real pledge activity by this investor across the platform. */
  pledgeCount: number;
  indicated: number;
  /** Relative time since this investor's last indication, e.g. "2h" / "5d". */
  lastActiveLabel: string | null;
  momentum: InvestorMomentum | null;
  /** Investor quality trend — null until investor-side snapshots exist. */
  trend: null;
};

export type FounderPrivateMarketSummary = {
  investorUniverse: number;
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

function relativeShort(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function momentumFor(ms: number): InvestorMomentum {
  if (ms < 24 * 60 * 60 * 1000) return "active";
  if (ms < 7 * 24 * 60 * 60 * 1000) return "warm";
  return "quiet";
}

type Activity = { count: number; sum: number; last: number };

/**
 * Rank approved platform investors by fit to the founder's company, enriched
 * with real pledge activity + momentum. Identities are anonymized. Trend is
 * intentionally null (no investor-side score history is collected yet).
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

  // Real pledge activity per investor (count, indicated total, last active).
  const ids = scored
    .map((s) => s.investor.profile_id)
    .filter((id): id is string => Boolean(id));
  const activity = new Map<string, Activity>();

  if (ids.length > 0) {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("investor_interests")
      .select("investor_id, pledge_amount, pledge_amount_updated_at")
      .in("investor_id", ids)
      .not("pledge_amount", "is", null);

    for (const row of data ?? []) {
      const id = row.investor_id;
      if (!id) continue;
      const agg = activity.get(id) ?? { count: 0, sum: 0, last: 0 };
      agg.count += 1;
      agg.sum += row.pledge_amount != null ? Number(row.pledge_amount) : 0;
      const t = row.pledge_amount_updated_at ? new Date(row.pledge_amount_updated_at).getTime() : 0;
      if (t > agg.last) agg.last = t;
      activity.set(id, agg);
    }
  }

  const now = Date.now();
  const rows: FounderInvestorRow[] = scored.map(({ investor, match }, index) => {
    const sectors = tokens(investor.preferred_sectors);
    const type = investor.investor_type ? String(investor.investor_type) : "Investor";
    const code =
      (investor.profile_id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() ||
      String(index + 1).padStart(4, "0");
    const agg = investor.profile_id ? activity.get(investor.profile_id) : undefined;
    const lastMs = agg && agg.last ? now - agg.last : null;
    return {
      symbol: `INV·${code}`,
      label: sectors.length ? `${type} · ${sectors.slice(0, 2).join(", ")} focus` : type,
      matchScore: match.matchScore,
      band: matchBand(match.matchScore),
      checkSize: formatCheck(investor.check_size_min ?? null, investor.check_size_max ?? null),
      sectors,
      pledgeCount: agg?.count ?? 0,
      indicated: agg?.sum ?? 0,
      lastActiveLabel: lastMs != null ? relativeShort(lastMs) : null,
      momentum: lastMs != null ? momentumFor(lastMs) : null,
      trend: null,
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
