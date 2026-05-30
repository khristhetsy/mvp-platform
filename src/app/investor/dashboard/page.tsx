import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { DealCard } from "@/components/DealCard";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  getCompanyPledgeSummaries,
  emptyCompanyPledgeSummary,
} from "@/lib/data/investor-pledges";
import {
  InvestorActivityTimelineSection,
  InvestorActivityTimelineSkeleton,
} from "@/components/InvestorActivityTimeline";
import {
  listInvestorInterests,
  listInvestorIntroRequests,
  listInvestorSavedDeals,
} from "@/lib/data/investor-interests";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function labelForRow(row: unknown) {
  const companies = (row as { companies?: { company_name?: string | null } | null }).companies;
  return companies?.company_name ?? "Unknown company";
}

export default async function InvestorDashboardPage() {
  const profile = await requireRole(["investor"]);
  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();

  const [{ data: interests }, { data: intros }, { data: saved }, listings] = await Promise.all([
    listInvestorInterests(supabase, profile.id),
    listInvestorIntroRequests(supabase, profile.id),
    listInvestorSavedDeals(supabase, profile.id),
    listMarketplaceListings(supabase).catch(() => []),
  ]);

  const featuredListings = listings.slice(0, 3);
  const pledgeSummaries =
    featuredListings.length > 0
      ? await getCompanyPledgeSummaries(
          serviceSupabase,
          featuredListings.map((deal) => deal.id),
        )
      : {};

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Track opportunities, watchlist, expressed interest, and marketplace activity.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Opportunities"
          value={String(listings.length)}
          detail="Published marketplace listings"
          accent="indigo"
        />
        <MetricCard
          label="Watchlist"
          value={String(saved?.length ?? 0)}
          detail={saved?.slice(0, 2).map(labelForRow).join(", ") || "No saved deals yet"}
          accent="violet"
        />
        <MetricCard
          label="Expressed Interest"
          value={String(interests?.length ?? 0)}
          detail={interests?.slice(0, 2).map(labelForRow).join(", ") || "None yet"}
          accent="blue"
        />
        <MetricCard
          label="Investments / Future"
          value="—"
          detail="Portfolio tracking coming soon"
          accent="slate"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Messages" subtitle="Founder and platform communication">
          <p className="text-sm text-slate-600">Secure messaging workspace coming soon.</p>
          <p className="mt-3 text-sm text-slate-500">
            {intros?.length ?? 0} intro {intros?.length === 1 ? "request" : "requests"} pending follow-up.
          </p>
        </WorkspacePanel>

        <WorkspacePanel
          title="Recommended Opportunities"
          subtitle="Curated marketplace listings"
          action={
            <Link href="/deals" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              Browse all
            </Link>
          }
        >
          {featuredListings.length === 0 ? (
            <p className="text-sm text-slate-600">No published listings yet.</p>
          ) : (
            <div className="grid gap-4">
              {featuredListings.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.slug}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <p className="font-semibold text-slate-950">{deal.companyName}</p>
                  <p className="mt-1 text-xs text-slate-500">{deal.industry ?? "Private company"}</p>
                </Link>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </section>

      <section className="mt-6">
        <Suspense fallback={<InvestorActivityTimelineSkeleton />}>
          <InvestorActivityTimelineSection investorId={profile.id} />
        </Suspense>
      </section>

      <section className="mt-6">
        <WorkspacePanel title="Marketplace preview" subtitle="Featured deal cards">
          <div className="grid gap-5 lg:grid-cols-3">
            {featuredListings.length === 0 ? (
              <p className="text-sm text-slate-600">No published listings yet.</p>
            ) : (
              featuredListings.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  pledgeSummary={pledgeSummaries[deal.id] ?? emptyCompanyPledgeSummary()}
                />
              ))
            )}
          </div>
        </WorkspacePanel>
      </section>
    </AppShell>
  );
}
