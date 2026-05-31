import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { InvestorOpportunitiesModuleViews } from "@/components/investor/InvestorOpportunitiesModuleViews";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorOpportunitiesPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const { matches } = await loadInvestorRecommendedMatches(supabase, investorId, 24);

  const opportunityRows = matches.map((row) => ({
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
    matchScore: row.matchScore,
    matchReasons: row.matchReasons,
    missingFitReasons: row.missingFitReasons,
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
          description="Rule-based matches using your onboarding preferences and published marketplace companies. No external enrichment or AI provider."
          actions={
            <p className="text-sm text-slate-500">
              <Link href="/deals" className="font-semibold text-[var(--navy)] hover:underline">
                Browse marketplace
              </Link>
              {" · "}
              <Link href="/investor/dashboard" className="font-semibold text-[var(--navy)] hover:underline">
                Dashboard
              </Link>
            </p>
          }
        />

        <InvestorApprovalBanner investorProfile={investorProfile} />

        <InvestorOpportunitiesModuleViews matches={opportunityRows} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
