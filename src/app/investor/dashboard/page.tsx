import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { DealCard } from "@/components/DealCard";
import {
  getCompanyPledgeSummaries,
  emptyCompanyPledgeSummary,
} from "@/lib/data/investor-pledges";
import {
  InvestorActivityTimelineSection,
  InvestorActivityTimelineSkeleton,
} from "@/components/InvestorActivityTimeline";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
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
    <AppShell role="INVESTOR">
      <SectionHeader
        eyebrow="Investor dashboard"
        title="Your private deal workflow"
        description="Track saved deals, expressed interest, intro requests, and marketplace opportunities."
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Saved deals"
          value={String(saved?.length ?? 0)}
          detail={saved?.slice(0, 2).map(labelForRow).join(", ") || "None yet"}
        />
        <MetricCard
          label="Expressed interest"
          value={String(interests?.length ?? 0)}
          detail={interests?.slice(0, 2).map(labelForRow).join(", ") || "None yet"}
        />
        <MetricCard
          label="Intro requests"
          value={String(intros?.length ?? 0)}
          detail={intros?.slice(0, 2).map(labelForRow).join(", ") || "None yet"}
        />
      </section>

      <Suspense fallback={<InvestorActivityTimelineSkeleton />}>
        <InvestorActivityTimelineSection investorId={profile.id} />
      </Suspense>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">Marketplace opportunities</h2>
          <Link href="/deals" className="text-sm font-semibold text-slate-700">
            Browse all deals
          </Link>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {listings.length === 0 ? (
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
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {[
          ["Saved deals", saved ?? []],
          ["Expressed interest", interests ?? []],
          ["Intro requests", intros ?? []],
        ].map(([title, items]) => (
          <div key={title as string} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-950">{title as string}</h2>
            <div className="mt-4 grid gap-3">
              {(items as Array<{ id: string; status?: string | null; companies?: { company_name?: string | null } | null }>).length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                (items as Array<{ id: string; status?: string | null; companies?: { company_name?: string | null } | null }>).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-medium">{labelForRow(item)}</p>
                    {item.status ? <p className="mt-1 text-xs text-slate-500">{item.status}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
