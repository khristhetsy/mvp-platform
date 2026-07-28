import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorContacts, loadContactPreferences } from "@/lib/investors/load-investor-matches";
import { scoreInvestorPreferenceMatch } from "@/lib/investors/preference-match";
import { SalesHubHeader } from "../SalesHubHeader";
import { FounderMatchClient, type MatchInvestor, type FounderRow } from "./FounderMatchClient";

export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  company_name: string | null;
  industry: string | null;
  funding_amount: number | null;
  revenue_stage: string | null;
  use_of_funds: string | null;
};

export default async function FounderMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ investor?: string }>;
}) {
  const profile = await requireRole(["admin", "analyst"]);
  const investorId = (await searchParams).investor ?? null;

  // Investor picker: contacts that carry structured preferences.
  const investorContacts = await loadInvestorContacts({ limit: 800 });
  const investors: MatchInvestor[] = investorContacts.map((i) => ({ id: i.id, name: i.name, company: i.company }));

  let rows: FounderRow[] = [];
  if (investorId) {
    const inv = await loadContactPreferences(investorId);
    if (inv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createServiceRoleClient() as any;
      const { data } = await db
        .from("companies")
        .select("id, company_name, industry, funding_amount, revenue_stage, use_of_funds")
        .limit(800);
      const companies = (data ?? []) as CompanyRow[];
      rows = companies
        .map((c) => {
          const match = scoreInvestorPreferenceMatch(
            {
              fundingAmount: c.funding_amount,
              revenue: null,
              revenueStage: c.revenue_stage,
              useOfFunds: c.use_of_funds,
              industry: c.industry,
            },
            inv.preferences,
          );
          return {
            id: c.id,
            name: c.company_name ?? "Unnamed company",
            industry: c.industry,
            revenueStage: c.revenue_stage,
            fundingAmount: c.funding_amount,
            score: match.score,
            reasons: match.reasons,
          };
        })
        .sort((a, b) => b.score - a.score);
    }
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <SalesHubHeader />
      <FounderMatchClient investors={investors} selectedId={investorId} rows={rows} />
    </AppShell>
  );
}
