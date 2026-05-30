import {
  listInvestorCompaniesWithMeetings,
  listInvestorVisibleCompanyUpdates,
} from "@/lib/company-updates/company-updates";
import type { CompanyUpdateRecord } from "@/lib/company-updates/types";
import { listInvestorWorkspaceDataForAuthenticatedInvestor } from "@/lib/data/investor-interests";
import type {
  InvestorInterestRecord,
  InvestorIntroRecord,
  InvestorSavedDealRecord,
} from "@/lib/data/investor-interests";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type PortfolioCompanyRow = {
  companyId: string;
  companyName: string;
  slug: string | null;
  detail: string;
  date: string | null;
};

function mapInterestRow(row: InvestorInterestRecord): PortfolioCompanyRow {
  const date = row.updated_at ?? row.created_at;
  return {
    companyId: row.company_id ?? "",
    companyName: row.companies?.company_name ?? "Company",
    slug: row.companies?.slug ?? null,
    detail:
      row.pledge_amount != null && Number(row.pledge_amount) > 0
        ? `Indicative pledge · ${row.pledge_currency ?? "USD"} ${row.pledge_amount}`
        : row.interest_amount != null
          ? `Indicative interest · ${row.interest_amount}`
          : "Expressed interest",
    date,
  };
}

export type InvestorPortfolioSnapshot = {
  pendingCommitments: PortfolioCompanyRow[];
  interestedCompanies: PortfolioCompanyRow[];
  introCompanies: PortfolioCompanyRow[];
  meetingCompanies: Awaited<ReturnType<typeof listInvestorCompaniesWithMeetings>>;
  watchlist: PortfolioCompanyRow[];
  companyUpdates: CompanyUpdateRecord[];
};

export async function loadInvestorPortfolio(investorId: string): Promise<InvestorPortfolioSnapshot> {
  const admin = createServiceRoleClient();
  const workspace = await listInvestorWorkspaceDataForAuthenticatedInvestor(investorId);
  const [updatesResult, meetingCompanies] = await Promise.all([
    listInvestorVisibleCompanyUpdates(investorId, 40),
    listInvestorCompaniesWithMeetings(admin, investorId),
  ]);

  const pendingCommitments = workspace.interests
    .filter(
      (row) =>
        row.company_id &&
        ((row.pledge_amount != null && Number(row.pledge_amount) > 0) ||
          (row.interest_amount != null && Number(row.interest_amount) > 0)),
    )
    .map(mapInterestRow)
    .filter((row) => row.companyId);

  const interestedCompanies = workspace.interests
    .filter((row) => row.company_id)
    .map(mapInterestRow)
    .filter((row) => row.companyId);

  const introCompanies = workspace.introRequests
    .filter((row) => row.company_id)
    .map((row: InvestorIntroRecord): PortfolioCompanyRow => ({
      companyId: row.company_id,
      companyName: row.companies?.company_name ?? "Company",
      slug: row.companies?.slug ?? null,
      detail: row.status ?? "Intro requested",
      date: row.created_at,
    }));

  const watchlist = workspace.savedDeals
    .filter((row) => row.company_id)
    .map((row: InvestorSavedDealRecord): PortfolioCompanyRow => ({
      companyId: row.company_id,
      companyName: row.companies?.company_name ?? "Company",
      slug: row.companies?.slug ?? null,
      detail: row.status ?? "Saved",
      date: row.updated_at ?? row.created_at,
    }));

  return {
    pendingCommitments,
    interestedCompanies,
    introCompanies,
    meetingCompanies,
    watchlist,
    companyUpdates: updatesResult.data ?? [],
  };
}
