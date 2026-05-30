import type { InvestorOwnCrmActivityResult } from "@/lib/data/investor-crm";
import type {
  InvestorInterestRecord,
  InvestorIntroRecord,
  InvestorSavedDealRecord,
  InvestorWorkspaceData,
} from "@/lib/data/investor-interests";
import {
  loadInvestorWorkspacePageData,
  type InvestorWorkspacePageData,
} from "@/lib/data/investor-workspace-page";

export const INVESTOR_WORKSPACE_LOADER =
  "loadInvestorWorkspacePageData (src/lib/data/investor-workspace-page.ts)";

type SafeDiagnosticRow = {
  id?: string;
  company_id?: string | null;
  company_name?: string | null;
  investor_id?: string;
  created_at?: string;
  pledge_amount?: number | null;
  activity_type?: string | null;
  stage?: string | null;
  message?: string | null;
};

function emptyInvestorWorkspacePageData(): InvestorWorkspacePageData {
  return {
    workspace: {
      interests: [],
      introRequests: [],
      savedDeals: [],
      errors: {
        interests: null,
        introRequests: null,
        savedDeals: null,
      },
    },
    crmActivity: {
      rows: [],
      error: null,
    },
  };
}

export async function loadInvestorWorkspacePageDataForDebug(investorId: string, crmLimit = 30) {
  try {
    const data = await loadInvestorWorkspacePageData(investorId, crmLimit);
    const errors = [
      data.workspace.errors.savedDeals,
      data.workspace.errors.interests,
      data.workspace.errors.introRequests,
      data.crmActivity.error,
    ].filter((message): message is string => Boolean(message));

    return {
      data,
      loadError: errors.length > 0 ? errors.join(" | ") : null,
    };
  } catch (error) {
    return {
      data: emptyInvestorWorkspacePageData(),
      loadError: error instanceof Error ? error.message : String(error),
    };
  }
}

function toSafeSavedDealRow(row: InvestorSavedDealRecord): SafeDiagnosticRow {
  return {
    id: row.id,
    company_id: row.company_id,
    company_name: row.companies?.company_name ?? null,
    investor_id: row.investor_id,
    created_at: row.created_at,
    stage: row.status,
  };
}

function toSafeInterestRow(row: InvestorInterestRecord): SafeDiagnosticRow {
  return {
    id: row.id,
    company_id: row.company_id,
    company_name: row.companies?.company_name ?? null,
    investor_id: row.investor_id,
    created_at: row.created_at,
    pledge_amount: row.pledge_amount,
    stage: row.status,
    message: row.message,
  };
}

function toSafeIntroRequestRow(row: InvestorIntroRecord): SafeDiagnosticRow {
  return {
    id: row.id,
    company_id: row.company_id,
    company_name: row.companies?.company_name ?? null,
    investor_id: row.investor_id,
    created_at: row.created_at,
    stage: row.status,
    message: row.message,
  };
}

function toSafeCrmActivityRow(row: InvestorOwnCrmActivityResult["rows"][number]): SafeDiagnosticRow {
  return {
    id: row.id,
    company_name: row.company_name,
    created_at: row.created_at,
    activity_type: row.activity_type,
  };
}

function formatSafeJson(row: SafeDiagnosticRow | null) {
  return row ? JSON.stringify(row, null, 2) : "null";
}

type InvestorWorkspaceDebugBoxProps = {
  route: string;
  authUserId: string;
  profileId: string;
  profileRole: string;
  workspace: InvestorWorkspaceData;
  crmActivity: InvestorOwnCrmActivityResult;
  loaderName?: string;
  error?: string | null;
};

export function InvestorWorkspaceDebugBox({
  route,
  authUserId,
  profileId,
  profileRole,
  workspace,
  crmActivity,
  loaderName = INVESTOR_WORKSPACE_LOADER,
  error = null,
}: InvestorWorkspaceDebugBoxProps) {
  const firstSavedDeal = workspace.savedDeals[0] ? toSafeSavedDealRow(workspace.savedDeals[0]) : null;
  const firstInterest = workspace.interests[0] ? toSafeInterestRow(workspace.interests[0]) : null;
  const firstIntroRequest = workspace.introRequests[0]
    ? toSafeIntroRequestRow(workspace.introRequests[0])
    : null;
  const firstCrmActivity = crmActivity.rows[0] ? toSafeCrmActivityRow(crmActivity.rows[0]) : null;

  return (
    <div data-testid="investor-workspace-debug">
      <p>RUNTIME DIAGNOSTICS (temporary)</p>
      <p>route: {route}</p>
      <p>loader: {loaderName}</p>
      <p>auth user id: {authUserId}</p>
      <p>profile id: {profileId}</p>
      <p>profile role: {profileRole}</p>
      <p>savedDeals count: {workspace.savedDeals.length}</p>
      <p>interests count: {workspace.interests.length}</p>
      <p>introRequests count: {workspace.introRequests.length}</p>
      <p>crmActivity count: {crmActivity.rows.length}</p>
      <p>error: {error ?? "none"}</p>
      <p>first savedDeal:</p>
      <pre>{formatSafeJson(firstSavedDeal)}</pre>
      <p>first interest:</p>
      <pre>{formatSafeJson(firstInterest)}</pre>
      <p>first introRequest:</p>
      <pre>{formatSafeJson(firstIntroRequest)}</pre>
      <p>first crmActivity:</p>
      <pre>{formatSafeJson(firstCrmActivity)}</pre>
    </div>
  );
}

type InvestorWorkspaceRawDiagnosticListsProps = {
  workspace: InvestorWorkspaceData;
  crmActivity: InvestorOwnCrmActivityResult;
};

export function InvestorWorkspaceRawDiagnosticLists({
  workspace,
  crmActivity,
}: InvestorWorkspaceRawDiagnosticListsProps) {
  const savedDeals = workspace.savedDeals.map(toSafeSavedDealRow);
  const interests = workspace.interests.map(toSafeInterestRow);
  const introRequests = workspace.introRequests.map(toSafeIntroRequestRow);
  const crmRows = crmActivity.rows.map(toSafeCrmActivityRow);

  return (
    <div data-testid="investor-workspace-raw-diagnostics">
      <p>RAW DIAGNOSTIC — Saved deals list ({savedDeals.length})</p>
      <pre>{JSON.stringify(savedDeals, null, 2)}</pre>
      <p>RAW DIAGNOSTIC — Interests list ({interests.length})</p>
      <pre>{JSON.stringify(interests, null, 2)}</pre>
      <p>RAW DIAGNOSTIC — Intro requests list ({introRequests.length})</p>
      <pre>{JSON.stringify(introRequests, null, 2)}</pre>
      <p>RAW DIAGNOSTIC — CRM activity list ({crmRows.length})</p>
      <pre>{JSON.stringify(crmRows, null, 2)}</pre>
    </div>
  );
}
