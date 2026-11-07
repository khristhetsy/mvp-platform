import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { PrivateMarketExperience } from "@/components/marketing/PrivateMarketExperience";
import type { ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { trackInvestorOpportunityView } from "@/lib/beta/track-investor-activation";
import { getMarketBoard, OUTREACH_COMPANY_WINDOW_DAYS } from "@/lib/data/market-board";
import { listApprovedCompanies, type ListedCompany } from "@/lib/listing/private-market";
import { matchScoresForInvestor } from "@/lib/matching/private-market-match";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * Investor Private Market: the signed in board (index tiles, top gainers, sectors
 * and every approved company) inside the investor workspace. Requesting an
 * introduction happens in the company one pager, so there is one place to browse
 * and one place to ask. Same data and components as the signed in /private-market.
 */
export default async function InvestorOpportunitiesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ company?: string | string[] }> }>) {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const { company: companyParam } = await searchParams;
  const initialSelectedId =
    typeof companyParam === "string" && /^[0-9a-f-]{36}$/i.test(companyParam) ? companyParam : null;
  const t = await getTranslations("appPages");
  void trackInvestorOpportunityView(investorId);

  const companies = await listApprovedCompanies().catch((err): ListedCompany[] => {
    console.error("[investor/opportunities] approved companies failed", err);
    return [];
  });
  const ids = companies.map((c) => c.id);

  const [board, matches, myIntrosRes] = await Promise.all([
    getMarketBoard(ids),
    matchScoresForInvestor(profile.id, ids),
    supabase.from("intro_requests").select("company_id").eq("investor_id", investorId),
  ]);

  const requestedIds = [
    ...new Set(
      ((myIntrosRes.data ?? []) as Array<{ company_id: string | null }>)
        .map((r) => r.company_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const stats: Record<string, ListingBoardStats> = {};
  for (const c of companies) {
    const b = board?.byCompany[c.id];
    stats[c.id] = {
      crrChange: b?.crr?.change ?? null,
      firstAt: b?.crr?.firstAt ?? null,
      outreachTotal: b?.outreachTotal ?? 0,
      outreachChange: b?.outreachChange ?? 0,
      match: matches.get(c.id) ?? null,
    };
  }

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
          description="Companies approved by iCapOS. Open a company for the one pager and to request an introduction."
          actions={
            <p className="flex flex-wrap gap-x-1 gap-y-1 text-sm text-slate-500">
              <Link href="/investor/dashboard" className="font-semibold text-[var(--blue)] hover:underline">
                Dashboard
              </Link>
            </p>
          }
        />

        <PrivateMarketExperience
          companies={companies}
          stats={stats}
          board={board}
          canRequest
          outreachWindowDays={OUTREACH_COMPANY_WINDOW_DAYS}
          requestedIds={requestedIds}
          initialSelectedId={initialSelectedId}
        />
      </WorkspacePageContainer>
    </AppShell>
  );
}
