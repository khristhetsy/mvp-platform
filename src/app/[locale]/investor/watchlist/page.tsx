import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { investorCompanyLabel, loadInvestorWorkspacePageData } from "@/lib/data/investor-workspace-page";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorWatchlistPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();
  const { workspace } = await loadInvestorWorkspacePageData(investorId);
  const savedDeals = workspace.savedDeals;

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Investor Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Watchlist</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Saved deals and companies you are tracking across the CapitalOS marketplace.
        </p>
      </div>

      <InvestorFeatureGate>
      <WorkspacePanel
        title="Saved deals"
        subtitle={`${savedDeals.length} ${savedDeals.length === 1 ? "company" : "companies"} on your watchlist`}
        action={
          <Link href="/deals" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Browse marketplace
          </Link>
        }
      >
        <div className="grid gap-3">
          {savedDeals.map((row) => {
            const companyName = investorCompanyLabel(row);
            const slug = row.companies?.slug ?? null;
            const date = row.created_at
              ? new Date(row.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })
              : "—";
            const content = (
              <>
                <p className="font-semibold text-slate-950">{companyName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Saved · {date}
                  {row.status ? ` · ${row.status}` : ""}
                </p>
              </>
            );

            return slug ? (
              <Link
                key={row.id}
                href={`/deals/${slug}`}
                className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-sm"
              >
                {content}
              </Link>
            ) : (
              <div key={row.id} className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3">
                {content}
              </div>
            );
          })}
        </div>
      </WorkspacePanel>
      </InvestorFeatureGate>
    </AppShell>
  );
}
