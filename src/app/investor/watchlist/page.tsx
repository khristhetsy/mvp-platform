import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WatchlistPageClient } from "@/components/investor/WatchlistPageClient";
import type { WatchlistRow } from "@/components/investor/WatchlistPageClient";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorWatchlistPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();

  const admin = createServiceRoleClient();
  const { data: savedDeals } = await admin
    .from("saved_deals")
    .select(
      "id, company_id, status, created_at, companies(company_name, slug, industry, revenue_stage, state, country)",
    )
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });

  const rows: WatchlistRow[] = (savedDeals ?? []).map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const location = [company?.state, company?.country].filter(Boolean).join(", ");
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: company?.company_name ?? `Company ${row.company_id}`,
      slug: company?.slug ?? null,
      industry: company?.industry ?? null,
      stage: company?.revenue_stage ?? null,
      location: location || null,
      dateSaved: row.created_at ?? null,
      status: row.status ?? "Saved",
    };
  });

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Investor workspace"
          title="Watchlist"
          description="Saved deals and companies you are tracking across the CapitalOS marketplace."
        />
        <InvestorFeatureGate>
          <WatchlistPageClient rows={rows} />
        </InvestorFeatureGate>
      </WorkspacePageContainer>
    </AppShell>
  );
}
