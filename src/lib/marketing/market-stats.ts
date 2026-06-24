import { getCompanyPledgeSummaries, type CompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { loadApprovedInvestorMatchProfiles, loadMarketplaceCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import { fillPercent, toSymbol } from "@/lib/investor/private-market";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PublicMarketDeal = {
  symbol: string;
  name: string;
  sector: string | null;
  readiness: number | null;
  fillPct: number | null;
  totalIndicated: number;
  fundingTarget: number | null;
};

export type PublicMarketStats = {
  /** Sum of indications updated in the last 30 days, across the marketplace. */
  indicated30d: number;
  activeInvestors: number;
  diligenceReady: number;
  /** Average readiness across published companies; 0 when none. */
  avgReadiness: number;
  deals: PublicMarketDeal[];
};

const EMPTY: PublicMarketStats = {
  indicated30d: 0,
  activeInvestors: 0,
  diligenceReady: 0,
  avgReadiness: 0,
  deals: [],
};

/**
 * Real, public marketplace aggregates for the marketing homepage. Everything is
 * sourced from live data; absent data yields 0 / empty rather than placeholders.
 */
export async function loadPublicMarketStats(): Promise<PublicMarketStats> {
  try {
    const admin = createServiceRoleClient();
    const [profiles, investors] = await Promise.all([
      loadMarketplaceCompanyMatchProfiles(admin),
      loadApprovedInvestorMatchProfiles(),
    ]);

    const companyIds = profiles.map((p) => p.id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [pledges, indicatedRes] = await Promise.all([
      companyIds.length
        ? getCompanyPledgeSummaries(admin, companyIds)
        : Promise.resolve<Record<string, CompanyPledgeSummary>>({}),
      admin
        .from("investor_interests")
        .select("pledge_amount")
        .not("pledge_amount", "is", null)
        .gte("pledge_amount_updated_at", since),
    ]);

    const indicated30d = (indicatedRes.data ?? []).reduce(
      (sum, row) => sum + (row.pledge_amount != null ? Number(row.pledge_amount) : 0),
      0,
    );

    const readinessVals = profiles
      .map((p) => p.readinessScore)
      .filter((n): n is number => n != null && Number.isFinite(n));
    const avgReadiness =
      readinessVals.length > 0
        ? Math.round((readinessVals.reduce((a, b) => a + b, 0) / readinessVals.length) * 10) / 10
        : 0;

    const deals: PublicMarketDeal[] = profiles.slice(0, 6).map((p) => {
      const total = pledges[p.id]?.totalPledged ?? 0;
      const target = p.fundingAmount ?? null;
      return {
        symbol: toSymbol(p.companyName),
        name: p.companyName,
        sector: p.industry,
        readiness: p.readinessScore ?? null,
        fillPct: fillPercent(total, target),
        totalIndicated: total,
        fundingTarget: target,
      };
    });

    return {
      indicated30d,
      activeInvestors: investors.length,
      diligenceReady: profiles.length,
      avgReadiness,
      deals,
    };
  } catch {
    return EMPTY;
  }
}
