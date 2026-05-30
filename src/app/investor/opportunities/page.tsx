import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorOpportunitiesPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);
  const { matches } = await loadInvestorRecommendedMatches(supabase, investorId, 24);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Matched opportunities"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Opportunities</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Rule-based matches using your onboarding preferences and published marketplace companies. No external
          enrichment or AI provider.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          <Link href="/deals" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Browse full marketplace
          </Link>
          {" · "}
          <Link href="/investor/dashboard" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Dashboard
          </Link>
        </p>
      </div>

      <InvestorApprovalBanner investorProfile={investorProfile} />

      <WorkspacePanel
        title="Recommended for you"
        subtitle="Sorted by CapitalOS match score (sector, stage, check size, geography, readiness)"
      >
        {matches.length === 0 ? (
          <p className="text-sm text-slate-600">
            No marketplace listings available yet, or complete investor onboarding to improve match quality.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((row) => (
              <InvestorMatchOpportunityCard
                key={row.company.id}
                companyName={row.company.companyName}
                slug={row.company.slug}
                industry={row.company.industry}
                stage={row.company.stage}
                location={row.company.geography}
                fundingTarget={
                  row.company.fundingAmount != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(row.company.fundingAmount)
                    : null
                }
                matchScore={row.matchScore}
                matchReasons={row.matchReasons}
                missingFitReasons={row.missingFitReasons}
              />
            ))}
          </div>
        )}
      </WorkspacePanel>
    </AppShell>
  );
}
