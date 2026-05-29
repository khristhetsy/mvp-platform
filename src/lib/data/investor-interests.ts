import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertInvestorCanActOnDeal,
  resolveDealTarget,
  type ResolveDealTargetInput,
} from "@/lib/data/investor-actions";
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
    interestAmount?: number | null;
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
    interest_amount: input.interestAmount ?? null,
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
      interest_amount: input.interestAmount ?? null,
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
    message: input.message ?? "Investor requested ICFO platform follow-up.",
  });
}

export async function listInvestorInterests(supabase: SupabaseClient<Database>, investorId: string) {
  return supabase
    .from("investor_interests")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export async function listInvestorIntroRequests(supabase: SupabaseClient<Database>, investorId: string) {
  return supabase
    .from("intro_requests")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export async function listInvestorSavedDeals(supabase: SupabaseClient<Database>, investorId: string) {
  return supabase
    .from("saved_deals")
    .select("*, companies(company_name, slug), campaigns(title, slug)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}

export async function listFounderInvestorActivity(supabase: SupabaseClient<Database>, companyId: string) {
  const [interests, intros, saved] = await Promise.all([
    supabase
      .from("investor_interests")
      .select("id, status, created_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("intro_requests")
      .select("id, status, created_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("saved_deals")
      .select("id, status, created_at, profiles:investor_id(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    interests: interests.data ?? [],
    introRequests: intros.data ?? [],
    savedDeals: saved.data ?? [],
  };
}

export async function listAdminInvestorActivity(supabase: SupabaseClient<Database>) {
  const [interests, intros, saved] = await Promise.all([
    supabase
      .from("investor_interests")
      .select("id, status, interest_amount, message, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("intro_requests")
      .select("id, status, message, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("saved_deals")
      .select("id, status, created_at, profiles:investor_id(full_name, email), companies(company_name, slug)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    interests: interests.data ?? [],
    introRequests: intros.data ?? [],
    savedDeals: saved.data ?? [],
  };
}
