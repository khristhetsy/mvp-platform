import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { InvestorActivityTimeline } from "@/components/InvestorActivityTimeline";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { InvestorApprovalBanner } from "@/components/InvestorApprovalBanner";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { InvestorMatchOpportunityCard } from "@/components/InvestorMatchOpportunityCard";
import { loadInvestorRecommendedMatches } from "@/lib/matching/load-investor-recommendations";
import { loadInvestorWorkspaceContext } from "@/lib/investor/load-investor-workspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { investorProfile } = await loadInvestorWorkspaceContext(profile);

  const [{ workspace, crmActivity }, { matches }] = await Promise.all([
    loadInvestorWorkspacePageData(investorId),
    loadInvestorRecommendedMatches(supabase, investorId, 4),
  ]);
  const savedDeals = workspace.savedDeals;
  const interests = workspace.interests;
  const introRequests = workspace.introRequests;
  const topMatches = matches.slice(0, 4);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track opportunities, watchlist, expressed interest, and marketplace activity.
        </p>
      </div>

      <InvestorApprovalBanner investorProfile={investorProfile} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Opportunities"
          value={String(matches.length)}
          detail="Published listings ranked for your profile"
          accent="indigo"
        />
        <MetricCard
          label="Watchlist"
          value={String(savedDeals.length)}
          detail={savedDeals.slice(0, 2).map(investorCompanyLabel).join(", ") || "No saved deals yet"}
          accent="violet"
        />
        <MetricCard
          label="Expressed Interest"
          value={String(interests.length)}
          detail={interests.slice(0, 2).map(investorCompanyLabel).join(", ") || "None yet"}
          accent="blue"
        />
        <MetricCard
          label="Portfolio / Future Investments"
          value="—"
          detail="Portfolio tracking coming soon"
          accent="slate"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Portfolio / Future Investments" subtitle="Committed and pipeline investments">
          <p className="text-sm text-slate-600">Portfolio tracking and future investment pipeline coming soon.</p>
          <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {introRequests.length} intro {introRequests.length === 1 ? "request" : "requests"} pending follow-up.
          </p>
        </WorkspacePanel>

        <WorkspacePanel
          title="Recommended for you"
          subtitle="Match score from your onboarding preferences"
          action={
            <Link href="/investor/opportunities" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              View all matches
            </Link>
          }
        >
          {topMatches.length === 0 ? (
            <p className="text-sm text-slate-600">No published listings yet. Complete onboarding to improve matches.</p>
          ) : (
            <div className="grid gap-3">
              {topMatches.map((row) => (
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
      </section>

      <section className="mt-8">
        <InvestorActivityTimeline activities={crmActivity.rows} error={crmActivity.error} />
      </section>
    </AppShell>
  );
}
