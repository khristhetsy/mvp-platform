import { AppShell } from "@/components/AppShell";
import { InvestorFeatureGate } from "@/components/InvestorFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WatchlistPageClient } from "@/components/investor/WatchlistPageClient";
import type { WatchlistRow } from "@/components/investor/WatchlistPageClient";
import { InvestorWatchlistAISummary } from "@/components/investor/InvestorWatchlistAISummary";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorWatchlistPage() {
  const { profile, investorId } = await requireInvestorWorkspaceSession();

  const admin = createServiceRoleClient();
  // Cast required: notes column added in migration 20260619004, types not yet regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: savedDeals } = await (admin as any)
    .from("saved_deals")
    .select(
      "id, company_id, status, notes, created_at, companies(company_name, slug, industry, revenue_stage, state, country)",
    )
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: string;
        company_id: string;
        status: string | null;
        notes: string | null;
        created_at: string | null;
        companies:
          | { company_name?: string | null; slug?: string | null; industry?: string | null; revenue_stage?: string | null; state?: string | null; country?: string | null }
          | Array<{ company_name?: string | null; slug?: string | null; industry?: string | null; revenue_stage?: string | null; state?: string | null; country?: string | null }>
          | null;
      }> | null;
    };

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
      notes: row.notes ?? null,
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
          <InvestorWatchlistAISummary rows={rows} />
          <WatchlistPageClient rows={rows} />
        </InvestorFeatureGate>
      </WorkspacePageContainer>
    </AppShell>
  );
}
