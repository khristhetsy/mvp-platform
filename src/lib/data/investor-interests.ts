import type { SupabaseClient } from "@supabase/supabase-js";
import { getCampaignBySlug, isUuid } from "@/lib/data/campaigns";
import type { Database } from "@/lib/supabase/types";

type InvestorInterestInsert = Database["public"]["Tables"]["investor_interests"]["Insert"];

export type CreateInvestorInterestInput = Omit<InvestorInterestInsert, "campaign_id"> & {
  campaignSlug: string;
};

export async function createInvestorInterest(supabase: SupabaseClient<Database>, input: CreateInvestorInterestInput) {
  const campaignSlug = input.campaignSlug.trim();

  if (!campaignSlug) {
    return {
      data: null,
      error: { message: "Campaign slug is required.", code: "invalid_slug" },
    };
  }

  const { data: campaign, error: lookupError } = await getCampaignBySlug(supabase, campaignSlug);

  if (lookupError) {
    return { data: null, error: lookupError };
  }

  if (!campaign?.id || !isUuid(campaign.id)) {
    return {
      data: null,
      error: {
        message: `No campaign found for slug "${campaignSlug}".`,
        code: "campaign_not_found",
      },
    };
  }

  const { campaignSlug: _slug, ...interest } = input;

  return supabase
    .from("investor_interests")
    .insert({
      ...interest,
      campaign_id: campaign.id,
    })
    .select("*")
    .single();
}

export async function listInvestorInterests(supabase: SupabaseClient<Database>, investorId: string) {
  return supabase
    .from("investor_interests")
    .select("*, campaigns(*)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}
