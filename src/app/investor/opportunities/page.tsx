import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { InvestorPrivateMarketBoard } from "@/components/investor/InvestorPrivateMarketBoard";
import { InvestorPrivateMarketSummary } from "@/components/investor/InvestorPrivateMarketSummary";
import { InvestorPrivateMarketTicker } from "@/components/investor/InvestorPrivateMarketTicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getCompanyPledgeSummaries, type CompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { getCompanyMetricHistory } from "@/lib/investor/metric-snapshots";
import { isFillingFast, readinessTrend, type MetricSnapshot } from "@/lib/investor/metric-trends";
import {
  averageReadiness,
  fillPercent,
  toSymbol,
  type PrivateMarketDeal,
  type PrivateMarketSummary,
} from "@/lib/investor/private-market";
import { trackInvestorOpportunityView } from "@/lib/beta/track-investor-activation";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { DiligenceCompleteMarket } from "@/components/investor/listing/DiligenceCompleteMarket";
import { listDiligenceCompleteCompanies, listingFacets, type ListedCompany } from "@/lib/listing/private-market";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function InvestorOpportunitiesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ company?: string | string[] }> }>) {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { company: companyParam } = await searchParams;
  const highlightId = typeof companyParam === "string" && /^[0-9a-f-]{36}$/i.test(companyParam) ? companyParam : null;
  const t = await getTranslations("appPages");
  void trackInvestorOpportunityView(investorId);

  // eslint-disable-next-line react-hooks/purity -- server component; time window is intentional
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [{ matches }, my30dRes, listed, myIntrosRes] = await Promise.all([
    loadInvestorRecommendedMatches(supabase, investorId, 24),
    supabase
      .from("investor_interests")
      .select("company_id, pledge_amount, pledge_amount_updated_at")
      .eq("investor_id", investorId)
      .not("pledge_amount", "is", null)
      .gte("pledge_amount_updated_at", thirtyDaysAgo),
    // Diligence complete companies (any CRR). A failed read hides the section's
    // rows rather than the whole page.
    listDiligenceCompleteCompanies().catch((err): ListedCompany[] => {
      console.error("[investor/opportunities] private market listing failed", err);
      return [];
    }),
    supabase.from("intro_requests").select("company_id").eq("investor_id", investorId),
  ]);
  const listingFacetValues = listingFacets(listed);
  const requestedIds = [
    ...new Set(((myIntrosRes.data ?? []) as Array<{ company_id: string | null }>).map((r) => r.company_id).filter((id): id is string => !!id)),
  ];

  const rankedMatches = matches ?? [];
  const companyIds = rankedMatches.map((row) => row.company.id);

  // Aggregate indicated interest per company (fill bars) + snapshot history (trend / filling fast).
  let pledgeSummaries: Record<string, CompanyPledgeSummary> = {};
  let history = new Map<string, MetricSnapshot[]>();
  if (companyIds.length) {
    [pledgeSummaries, history] = await Promise.all([
      getCompanyPledgeSummaries(supabase, companyIds),
      getCompanyMetricHistory(supabase, companyIds, 30),
    ]);
  }

  const deals: PrivateMarketDeal[] = rankedMatches.map((row) => {
    const summary = pledgeSummaries[row.company.id];
    const totalIndicated = summary?.totalPledged ?? 0;
    const fundingTarget = row.company.fundingAmount ?? null;
    const snaps = history.get(row.company.id) ?? [];
    const trend = readinessTrend(snaps);
    return {
      companyId: row.company.id,
      companyName: row.company.companyName,
      symbol: toSymbol(row.company.companyName),
      slug: row.company.slug,
      industry: row.company.industry,
      readinessScore: row.company.readinessScore ?? null,
      matchScore: row.matchScore,
      totalIndicated,
      fundingTarget,
      fillPct: fillPercent(totalIndicated, fundingTarget),
      currency: summary?.currency ?? "USD",
      trend,
      fillingFast: isFillingFast(snaps),
    };
  });

  // Investor's own indicated total over the last 30 days.
  const my30dRows = my30dRes.data ?? [];
  const indicated30d = my30dRows.reduce(
    (sum, r) => sum + (r.pledge_amount != null ? Number(r.pledge_amount) : 0),
    0,
  );
  const indicated30dCount = new Set(
    my30dRows.map((r) => r.company_id).filter((id): id is string => !!id),
  ).size;

  const summary: PrivateMarketSummary = {
    matchedCount: deals.length,
    indicated30d,
    indicated30dCount,
    avgReadiness: averageReadiness(deals.map((d) => d.readinessScore)),
    fillingFastCount: deals.filter((d) => d.fillingFast).length,
  };

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("private_market")}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("investor_workspace_2")}
          title={t("private_market")}
          description={t("diligence_ready_deals_scored_and_ranked_to_you")}
          actions={
            <p className="flex flex-wrap gap-x-1 gap-y-1 text-sm text-slate-500">
              <Link href="/deals" className="font-semibold text-[var(--blue)] hover:underline">
                Browse marketplace
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/investor/dashboard"
                className="font-semibold text-[var(--blue)] hover:underline"
              >
                Dashboard
              </Link>
            </p>
          }
        />

        <InvestorPrivateMarketTicker deals={deals} />

        <InvestorPrivateMarketSummary summary={summary} />

        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--indigo-soft)] border-l-[3px] border-l-[var(--indigo)] bg-[var(--indigo-soft)] px-4 py-3 text-xs leading-relaxed text-slate-600">
          <span aria-hidden="true">ⓘ</span>
          <span>
            <b className="text-[var(--navy)]">Information display only.</b> Capital Readiness Ratings and
            fill levels are informational. These are non-binding indications of interest, not
            commitments. Deal access is subject to accreditation verification. Nothing here is
            investment advice or a recommendation.
          </span>
        </div>

        <DiligenceCompleteMarket
          companies={listed}
          sectors={listingFacetValues.sectors}
          stages={listingFacetValues.stages}
          requestedIds={requestedIds}
          highlightId={highlightId}
        />

        <InvestorPrivateMarketBoard deals={deals} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
