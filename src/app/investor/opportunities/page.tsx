import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorOpportunitiesModuleViews } from "@/components/investor/InvestorOpportunitiesModuleViews";
import { InvestorForYouPanel } from "@/components/investor/InvestorForYouPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { trackInvestorOpportunityView } from "@/lib/beta/track-investor-activation";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorOpportunitiesPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  void trackInvestorOpportunityView(investorId);

  const [{ matches }, pledgeRes] = await Promise.all([
    loadInvestorRecommendedMatches(supabase, investorId, 24),
    supabase
      .from("investor_interests")
      .select("company_id, pledge_amount")
      .eq("investor_id", investorId)
      .not("pledge_amount", "is", null),
  ]);

  // Build a map of company_id → pledge_amount for O(1) lookup
  const pledgeByCompany = new Map<string, number>();
  for (const row of pledgeRes.data ?? []) {
    if (row.company_id && row.pledge_amount != null) {
      pledgeByCompany.set(row.company_id, row.pledge_amount as number);
    }
  }

  const opportunityRows = (matches ?? []).map((row) => ({
    companyId: row.company.id,
    companyName: row.company.companyName,
    slug: row.company.slug,
    industry: row.company.industry,
    stage: row.company.stage,
    location: row.company.geography,
    fundingTarget:
      row.company.fundingAmount != null
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(row.company.fundingAmount)
        : null,
    publishedAt: row.company.publishedAt ?? null,
    readinessScore: row.company.readinessScore ?? null,
    matchScore: row.matchScore,
    matchReasons: row.matchReasons,
    missingFitReasons: row.missingFitReasons,
    myPledgeAmount: pledgeByCompany.get(row.company.id) ?? null,
  }));

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Matched opportunities"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Investor workspace"
          title="Opportunities"
          description="Rule-based matches using your onboarding preferences and published marketplace companies."
          actions={
            <p className="flex flex-wrap gap-x-1 gap-y-1 text-sm text-slate-500">
              <Link href="/deals" className="font-semibold text-[var(--blue)] hover:underline">
                Browse marketplace
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/investor/dashboard" className="font-semibold text-[var(--blue)] hover:underline">
                Dashboard
              </Link>
            </p>
          }
        />

        <InvestorForYouPanel rows={opportunityRows} />
        <InvestorOpportunitiesModuleViews matches={opportunityRows} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
