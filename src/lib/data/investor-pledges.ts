import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertInvestorCanActOnDeal,
  resolveDealTarget,
} from "@/lib/data/investor-actions";
import type { InvestorActionClients } from "@/lib/data/investor-interests";
import type { Database } from "@/lib/supabase/types";

export type SubmitInvestorPledgeInput = {
  investorId: string;
  companyId?: string;
  companySlug?: string;
  pledgeAmount: number;
  pledgeCurrency?: string;
};

export async function submitInvestorPledge(
  clients: InvestorActionClients,
  input: SubmitInvestorPledgeInput,
) {
  const resolved = await resolveDealTarget(
    clients.supabase,
    {
      companyId: input.companyId,
      companySlug: input.companySlug,
      createCampaignIfMissing: true,
    },
    { serviceSupabase: clients.serviceSupabase },
  );

  if (resolved.error || !resolved.data) {
    return { error: resolved.error ?? { message: "Deal not found." } };
  }

  const blocked = assertInvestorCanActOnDeal(input.investorId, resolved.data);
  if ("error" in blocked) {
    return { error: blocked.error };
  }

  if (!resolved.data.campaignId) {
    return {
      error: {
        message: "Unable to create campaign record for this listing.",
        code: "campaign_missing",
      },
    };
  }

  const now = new Date().toISOString();
  const pledgeCurrency = input.pledgeCurrency ?? "USD";
  const pledgePayload = {
    pledge_amount: input.pledgeAmount,
    pledge_currency: pledgeCurrency,
    pledge_amount_updated_at: now,
    company_id: resolved.data.companyId,
    campaign_id: resolved.data.campaignId,
    updated_at: now,
  };

  const { data: existingByCompany } = await clients.supabase
    .from("investor_interests")
    .select("id")
    .eq("investor_id", input.investorId)
    .eq("company_id", resolved.data.companyId)
    .maybeSingle();

  let existingId = existingByCompany?.id;

  if (!existingId) {
    const { data: existingByCampaign } = await clients.supabase
      .from("investor_interests")
      .select("id")
      .eq("investor_id", input.investorId)
      .eq("campaign_id", resolved.data.campaignId)
      .maybeSingle();
    existingId = existingByCampaign?.id;
  }

  if (existingId) {
    return clients.supabase
      .from("investor_interests")
      .update(pledgePayload)
      .eq("id", existingId)
      .select("*")
      .single();
  }

  return clients.supabase
    .from("investor_interests")
    .insert({
      investor_id: input.investorId,
      company_id: resolved.data.companyId,
      campaign_id: resolved.data.campaignId,
      status: "interested",
      pledge_amount: input.pledgeAmount,
      pledge_currency: pledgeCurrency,
      pledge_amount_updated_at: now,
    })
    .select("*")
    .single();
}

export type CompanyPledgeSummary = {
  totalPledged: number;
  investorCount: number;
  currency: string;
};

export function emptyCompanyPledgeSummary(): CompanyPledgeSummary {
  return { totalPledged: 0, investorCount: 0, currency: "USD" };
}

export function formatPledgeTotal(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

type PledgeRow = {
  company_id: string | null;
  investor_id: string;
  pledge_amount: number | null;
  pledge_currency: string | null;
  campaign_id?: string | null;
};

type PledgeRpcRow = {
  company_id: string;
  total_pledged: number | string;
  investor_count: number | string;
  currency: string | null;
};

function aggregatePledgeRows(
  companyIds: string[],
  rows: PledgeRow[],
): Record<string, CompanyPledgeSummary> {
  const result: Record<string, CompanyPledgeSummary> = {};

  for (const companyId of companyIds) {
    result[companyId] = emptyCompanyPledgeSummary();
  }

  const buckets = new Map<
    string,
    { totalPledged: number; investorIds: Set<string>; currency: string }
  >();

  for (const row of rows) {
    if (!row.company_id || row.pledge_amount == null || Number(row.pledge_amount) <= 0) {
      continue;
    }

    const bucket =
      buckets.get(row.company_id) ??
      (() => {
        const created = {
          totalPledged: 0,
          investorIds: new Set<string>(),
          currency: row.pledge_currency ?? "USD",
        };
        buckets.set(row.company_id, created);
        return created;
      })();

    bucket.totalPledged += Number(row.pledge_amount);
    bucket.investorIds.add(row.investor_id);
    if (row.pledge_currency) {
      bucket.currency = row.pledge_currency;
    }
  }

  for (const [companyId, bucket] of buckets) {
    result[companyId] = {
      totalPledged: bucket.totalPledged,
      investorCount: bucket.investorIds.size,
      currency: bucket.currency,
    };
  }

  return result;
}

async function normalizePledgeRows(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
  interests: PledgeRow[],
): Promise<PledgeRow[]> {
  const companyIdSet = new Set(companyIds);
  const needsCampaignLookup = interests.some(
    (row) => !row.company_id && row.campaign_id && row.pledge_amount != null && Number(row.pledge_amount) > 0,
  );

  let campaignCompany = new Map<string, string>();

  if (needsCampaignLookup) {
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, company_id")
      .in("company_id", companyIds);

    campaignCompany = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.company_id]));
  }

  const rows: PledgeRow[] = [];

  for (const row of interests) {
    const resolvedCompanyId =
      row.company_id ?? (row.campaign_id ? (campaignCompany.get(row.campaign_id) ?? null) : null);

    if (!resolvedCompanyId || !companyIdSet.has(resolvedCompanyId)) {
      continue;
    }

    rows.push({ ...row, company_id: resolvedCompanyId });
  }

  return rows;
}

async function fetchPledgeSummariesViaRpc(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
): Promise<Record<string, CompanyPledgeSummary> | null> {
  const { data, error } = await supabase.rpc("get_companies_pledge_summaries", {
    p_company_ids: companyIds,
  });

  if (error) {
    return null;
  }

  const result = aggregatePledgeRows(companyIds, []);

  for (const row of (data ?? []) as PledgeRpcRow[]) {
    if (!row.company_id) {
      continue;
    }

    result[row.company_id] = {
      totalPledged: Number(row.total_pledged),
      investorCount: Number(row.investor_count),
      currency: row.currency ?? "USD",
    };
  }

  return result;
}

async function fetchPledgeSummariesViaSelect(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
): Promise<{ summaries: Record<string, CompanyPledgeSummary>; queryError: string | null }> {
  const empty = aggregatePledgeRows(companyIds, []);

  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, company_id")
    .in("company_id", companyIds);

  if (campaignError) {
    return { summaries: empty, queryError: campaignError.message };
  }

  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const queries = [
    supabase
      .from("investor_interests")
      .select("company_id, investor_id, pledge_amount, pledge_currency, campaign_id")
      .in("company_id", companyIds)
      .not("pledge_amount", "is", null),
  ];

  if (campaignIds.length > 0) {
    queries.push(
      supabase
        .from("investor_interests")
        .select("company_id, investor_id, pledge_amount, pledge_currency, campaign_id")
        .in("campaign_id", campaignIds)
        .is("company_id", null)
        .not("pledge_amount", "is", null),
    );
  }

  const results = await Promise.all(queries);
  const queryError = results.find((result) => result.error)?.error?.message ?? null;

  if (queryError) {
    return { summaries: empty, queryError };
  }

  const interests = results.flatMap((result) => (result.data ?? []) as PledgeRow[]);
  const rows = await normalizePledgeRows(supabase, companyIds, interests);
  return { summaries: aggregatePledgeRows(companyIds, rows), queryError: null };
}

export async function getCompanyPledgeSummaries(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
): Promise<Record<string, CompanyPledgeSummary>> {
  if (!companyIds.length) {
    return {};
  }

  const rpcSummaries = await fetchPledgeSummariesViaRpc(supabase, companyIds);
  if (rpcSummaries) {
    return rpcSummaries;
  }

  const { summaries } = await fetchPledgeSummariesViaSelect(supabase, companyIds);
  return summaries;
}

export async function getCompanyPledgeSummary(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<CompanyPledgeSummary> {
  const summaries = await getCompanyPledgeSummaries(supabase, [companyId]);
  return summaries[companyId] ?? emptyCompanyPledgeSummary();
}

/** Prefer the founder's published marketplace company when resolving pledge totals. */
export async function getFounderPledgeCompanyId(
  supabase: SupabaseClient<Database>,
  founderId: string,
  fallbackCompanyId: string,
): Promise<string> {
  const { data: published } = await supabase
    .from("companies")
    .select("id")
    .eq("founder_id", founderId)
    .eq("review_status", "approved")
    .eq("is_published", true)
    .eq("marketplace_visible", true)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return published?.id ?? fallbackCompanyId;
}

/** @deprecated Use getCompanyPledgeSummary instead. */
export async function getFounderPledgeSummary(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  return getCompanyPledgeSummary(supabase, companyId);
}
