import {
  listInvestorOwnCrmActivityForAuthenticatedInvestor,
  type InvestorOwnCrmActivityResult,
} from "@/lib/data/investor-crm";
import {
  listInvestorWorkspaceDataForAuthenticatedInvestor,
  type InvestorWorkspaceData,
} from "@/lib/data/investor-interests";

export type InvestorWorkspacePageData = {
  workspace: InvestorWorkspaceData;
  crmActivity: InvestorOwnCrmActivityResult;
};

/** Same loader used by /investor/dashboard and investor module pages. */
export async function loadInvestorWorkspacePageData(
  investorId: string,
  crmLimit = 30,
): Promise<InvestorWorkspacePageData> {
  const [workspace, crmActivity] = await Promise.all([
    listInvestorWorkspaceDataForAuthenticatedInvestor(investorId),
    listInvestorOwnCrmActivityForAuthenticatedInvestor(investorId, crmLimit),
  ]);

  return { workspace, crmActivity };
}

export function investorCompanyLabel(row: {
  companies?: { company_name?: string | null } | null;
  company_id?: string | null;
}) {
  const name = row.companies?.company_name?.trim();
  if (name) {
    return name;
  }

  if (row.company_id) {
    return `Company ${row.company_id}`;
  }

  return "Unknown company";
}
