import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertInvestorCanActOnDeal,
  resolveDealTarget,
  type ResolveDealTargetInput,
} from "@/lib/data/investor-actions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type InvestorActionTarget = Pick<ResolveDealTargetInput, "companyId" | "companySlug">;

export type InvestorActionClients = {
  /** Logged-in investor session — used for investor_interests / intro_requests / saved_deals writes. */
  supabase: SupabaseClient<Database>;
  /** Service role — used only for campaign auto-create/repair and marketplace reads. */
  serviceSupabase: SupabaseClient<Database>;
};

async function resolveInvestorActionTarget(
  clients: InvestorActionClients,
  input: InvestorActionTarget & { createCampaignIfMissing?: boolean },
) {
  return resolveDealTarget(
    clients.supabase,
    {
      companyId: input.companyId,
      companySlug: input.companySlug,
      createCampaignIfMissing: input.createCampaignIfMissing ?? false,
    },
    { serviceSupabase: clients.serviceSupabase },
  );
}

export async function upsertInvestorInterest(
  clients: InvestorActionClients,
  input: InvestorActionTarget & {
    investorId: string;
    message?: string | null;
  },
) {
  const resolved = await resolveInvestorActionTarget(clients, {
    ...input,
    createCampaignIfMissing: true,
  });

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
  const updatePayload = {
    company_id: resolved.data.companyId,
    campaign_id: resolved.data.campaignId,
    message: input.message ?? null,
    status: "interested",
    updated_at: now,
  };

  const { data: existing } = await clients.supabase
    .from("investor_interests")
    .select("id")
    .eq("investor_id", input.investorId)
    .eq("company_id", resolved.data.companyId)
    .maybeSingle();

  if (existing?.id) {
    return clients.supabase.from("investor_interests").update(updatePayload).eq("id", existing.id).select("*").single();
  }

  return clients.supabase
    .from("investor_interests")
    .insert({
      investor_id: input.investorId,
      company_id: resolved.data.companyId,
      campaign_id: resolved.data.campaignId,
      message: input.message ?? null,
      status: "interested",
    })
    .select("*")
    .single();
}

export async function createIntroRequest(
  clients: InvestorActionClients,
  input: InvestorActionTarget & {
    investorId: string;
    message?: string | null;
  },
) {
  const resolved = await resolveInvestorActionTarget(clients, {
    ...input,
    createCampaignIfMissing: true,
  });

  if (resolved.error || !resolved.data) {
    return { error: resolved.error ?? { message: "Deal not found." } };
  }

  const blocked = assertInvestorCanActOnDeal(input.investorId, resolved.data);
  if ("error" in blocked) {
    return { error: blocked.error };
  }

  return clients.supabase
    .from("intro_requests")
    .insert({
      investor_id: input.investorId,
      company_id: resolved.data.companyId,
      campaign_id: resolved.data.campaignId,
      message: input.message ?? null,
      status: "requested",
    })
    .select("*")
    .single();
}

export async function upsertSavedDeal(
  clients: InvestorActionClients,
  input: InvestorActionTarget & {
    investorId: string;
  },
) {
  const resolved = await resolveInvestorActionTarget(clients, {
    ...input,
    createCampaignIfMissing: true,
  });

  if (resolved.error || !resolved.data) {
    return { error: resolved.error ?? { message: "Deal not found." } };
  }

  const blocked = assertInvestorCanActOnDeal(input.investorId, resolved.data);
  if ("error" in blocked) {
    return { error: blocked.error };
  }

  const now = new Date().toISOString();

  return clients.supabase
    .from("saved_deals")
    .upsert(
      {
        investor_id: input.investorId,
        company_id: resolved.data.companyId,
        campaign_id: resolved.data.campaignId,
        status: "saved",
        updated_at: now,
      },
      { onConflict: "investor_id,company_id" },
    )
    .select("*")
    .single();
}

export async function createIcfoFollowUpRequest(
  clients: InvestorActionClients,
  input: InvestorActionTarget & {
    investorId: string;
    message?: string | null;
  },
) {
  return createIntroRequest(clients, {
    ...input,
    message: input.message ?? "Investor requested CapitalOS platform follow-up.",
  });
}

export async function listInvestorInterests(supabase: SupabaseClient<Database>, investorId: string) {
  // investorId must equal auth.uid() — same value API routes write to investor_id.
  return supabase
    .from("investor_interests")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export async function listInvestorIntroRequests(supabase: SupabaseClient<Database>, investorId: string) {
  // investorId must equal auth.uid() — same value API routes write to investor_id.
  return supabase
    .from("intro_requests")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export async function listInvestorSavedDeals(supabase: SupabaseClient<Database>, investorId: string) {
  // investorId must equal auth.uid() — same value API routes write to investor_id.
  return supabase
    .from("saved_deals")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export type InvestorInterestRecord = {
  id: string;
  investor_id: string;
  company_id: string | null;
  status: string | null;
  message: string | null;
  interest_amount: number | null;
  pledge_amount: number | null;
  pledge_currency: string | null;
  created_at: string;
  updated_at: string | null;
  companies: { company_name?: string | null; slug?: string | null } | null;
};

export type InvestorIntroRecord = {
  id: string;
  investor_id: string;
  company_id: string;
  status: string | null;
  message: string | null;
  created_at: string;
  companies: { company_name?: string | null; slug?: string | null } | null;
};

export type InvestorSavedDealRecord = {
  id: string;
  investor_id: string;
  company_id: string;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  companies: { company_name?: string | null; slug?: string | null } | null;
};

export type InvestorWorkspaceData = {
  interests: InvestorInterestRecord[];
  introRequests: InvestorIntroRecord[];
  savedDeals: InvestorSavedDealRecord[];
  errors: {
    interests: string | null;
    introRequests: string | null;
    savedDeals: string | null;
  };
};

export async function listInvestorWorkspaceData(
  supabase: SupabaseClient<Database>,
  investorId: string,
): Promise<InvestorWorkspaceData> {
  const [interestsResult, introsResult, savedResult] = await Promise.all([
    listInvestorInterests(supabase, investorId),
    listInvestorIntroRequests(supabase, investorId),
    listInvestorSavedDeals(supabase, investorId),
  ]);

  return {
    interests: (interestsResult.data ?? []) as InvestorInterestRecord[],
    introRequests: (introsResult.data ?? []) as InvestorIntroRecord[],
    savedDeals: (savedResult.data ?? []) as InvestorSavedDealRecord[],
    errors: {
      interests: interestsResult.error?.message ?? null,
      introRequests: introsResult.error?.message ?? null,
      savedDeals: savedResult.error?.message ?? null,
    },
  };
}

/** Server-side investor workspace reads scoped to the authenticated auth user id. */
export async function listInvestorWorkspaceDataForAuthenticatedInvestor(
  investorId: string,
): Promise<InvestorWorkspaceData> {
  const serviceSupabase = createServiceRoleClient();
  return listInvestorWorkspaceData(serviceSupabase, investorId);
}

type FounderInvestorProfileRef = {
  full_name?: string | null;
  email?: string | null;
};

export type FounderInvestorInterestRecord = {
  id: string;
  investor_id: string;
  status: string | null;
  message: string | null;
  interest_amount: number | null;
  pledge_amount: number | null;
  pledge_currency: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: FounderInvestorProfileRef | FounderInvestorProfileRef[] | null;
};

export type FounderInvestorIntroRecord = {
  id: string;
  investor_id: string;
  status: string | null;
  message: string | null;
  created_at: string;
  profiles: FounderInvestorProfileRef | FounderInvestorProfileRef[] | null;
};

export type FounderInvestorSavedRecord = {
  id: string;
  investor_id: string;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  profiles: FounderInvestorProfileRef | FounderInvestorProfileRef[] | null;
};

export type FounderCompanyCrmActivityRecord = {
  id: string;
  investor_id: string;
  activity_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  profiles: FounderInvestorProfileRef | FounderInvestorProfileRef[] | null;
};

export type FounderCompanyPipelineRecord = {
  investor_id: string;
  stage: string;
  last_activity_at: string | null;
  profiles: FounderInvestorProfileRef | FounderInvestorProfileRef[] | null;
};

export type FounderInvestorActivityResult = {
  interests: FounderInvestorInterestRecord[];
  introRequests: FounderInvestorIntroRecord[];
  savedDeals: FounderInvestorSavedRecord[];
  crmActivity: FounderCompanyCrmActivityRecord[];
  pipeline: FounderCompanyPipelineRecord[];
};

export async function listFounderInvestorActivity(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<FounderInvestorActivityResult> {
  const [interests, intros, saved, activities, pipelines] = await Promise.all([
    supabase
      .from("investor_interests")
      .select(
        "id, investor_id, status, message, interest_amount, pledge_amount, pledge_currency, created_at, updated_at, profiles:investor_id(full_name, email)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("intro_requests")
      .select("id, investor_id, status, message, created_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_deals")
      .select("id, investor_id, status, created_at, updated_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("investor_activity")
      .select(
        "id, investor_id, activity_type, created_at, metadata, profiles:investor_id(full_name, email)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("investor_pipeline")
      .select("investor_id, stage, last_activity_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("last_activity_at", { ascending: false }),
  ]);

  return {
    interests: (interests.data ?? []) as FounderInvestorInterestRecord[],
    introRequests: (intros.data ?? []) as FounderInvestorIntroRecord[],
    savedDeals: (saved.data ?? []) as FounderInvestorSavedRecord[],
    crmActivity: (activities.data ?? []) as FounderCompanyCrmActivityRecord[],
    pipeline: (pipelines.data ?? []) as FounderCompanyPipelineRecord[],
  };
}

export async function listAdminInvestorActivity(supabase: SupabaseClient<Database>) {
  const [interests, intros, saved] = await Promise.all([
    supabase
      .from("investor_interests")
      .select("id, investor_id, status, pledge_amount, pledge_currency, message, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("intro_requests")
      .select("id, investor_id, status, message, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("saved_deals")
      .select("id, investor_id, status, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    interests: interests.data ?? [],
    introRequests: intros.data ?? [],
    savedDeals: saved.data ?? [],
  };
}
