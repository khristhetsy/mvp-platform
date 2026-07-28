import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorContacts } from "@/lib/investors/load-investor-matches";
import { SalesHubHeader } from "../SalesHubHeader";
import { InvestorMatchClient, type MatchCompany, type MatchRow } from "./InvestorMatchClient";

export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  company_name: string | null;
  industry: string | null;
  funding_amount: number | null;
  revenue_stage: string | null;
  use_of_funds: string | null;
};

export default async function InvestorMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const profile = await requireRole(["admin", "analyst"]);
  const selectedId = (await searchParams).company ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data } = await db
    .from("companies")
    .select("id, company_name, industry, funding_amount, revenue_stage, use_of_funds")
    .order("company_name", { ascending: true })
    .limit(500);
  const companyRows = (data ?? []) as CompanyRow[];
  const companies: MatchCompany[] = companyRows.map((c) => ({
    id: c.id,
    name: c.company_name ?? "Unnamed company",
    industry: c.industry,
  }));

  const selected = selectedId ? companyRows.find((c) => c.id === selectedId) ?? null : null;

  let rows: MatchRow[] = [];
  if (selected) {
    const scored = await loadInvestorContacts({
      scoreAgainst: {
        fundingAmount: selected.funding_amount,
        revenue: null,
        revenueStage: selected.revenue_stage,
        useOfFunds: selected.use_of_funds,
        industry: selected.industry,
      },
      limit: 800,
    });
    rows = scored.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      company: s.company,
      score: s.match?.score ?? null,
      reasons: s.match?.reasons ?? [],
      investmentSize: s.preferences.investmentSize,
      useOfFunds: s.preferences.useOfFunds,
      dealsPerYear: s.preferences.dealsPerYear,
      revenueRange: s.preferences.revenueRange,
      activeRating: s.preferences.activeRating,
    }));
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
      <InvestorMatchClient companies={companies} selectedId={selectedId} rows={rows} />
    </AppShell>
  );
}
