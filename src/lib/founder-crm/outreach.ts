import type { SupabaseClient } from "@supabase/supabase-js";
import { OUTREACH_DAILY_LIMIT_MAX, type OutreachCampaignRecord, type OutreachMessageRecord } from "@/lib/founder-crm/types";
import type { Database } from "@/lib/supabase/types";

const ACTIVE_CAMPAIGN_STATUSES = ["draft", "queued", "active"];

export async function listOutreachCampaigns(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as OutreachCampaignRecord[] };
}

export async function countActiveOutreachCampaigns(
  supabase: SupabaseClient<Database>,
  founderId: string,
) {
  const { count, error } = await supabase
    .from("outreach_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("founder_id", founderId)
    .in("status", ACTIVE_CAMPAIGN_STATUSES);

  if (error) {
    return { error };
  }

  return { count: count ?? 0 };
}

export async function createOutreachCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    name: string;
    dailyLimit?: number;
  },
) {
  const active = await countActiveOutreachCampaigns(supabase, input.founderId);
  if (active.error) {
    return { error: active.error };
  }

  if ((active.count ?? 0) >= 1) {
    return { error: new Error("Only one active outreach campaign is allowed at a time.") };
  }

  const dailyLimit = Math.min(input.dailyLimit ?? OUTREACH_DAILY_LIMIT_MAX, OUTREACH_DAILY_LIMIT_MAX);
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      name: input.name.trim(),
      status: "draft",
      audience_count: 0,
      daily_limit: dailyLimit,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as OutreachCampaignRecord };
}

export async function queueOutreachCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    campaignId: string;
    founderId: string;
    messageIds: string[];
  },
) {
  const now = new Date().toISOString();
  const limit = OUTREACH_DAILY_LIMIT_MAX;

  if (input.messageIds.length > limit) {
    return {
      error: new Error(`Campaign exceeds daily limit of ${limit} messages. Reduce audience size.`),
    };
  }

  const { data: messages, error: msgError } = await supabase
    .from("outreach_messages")
    .update({ status: "queued", scheduled_at: now })
    .in("id", input.messageIds)
    .eq("status", "draft")
    .select("id");

  if (msgError) {
    return { error: msgError };
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("outreach_campaigns")
    .update({
      status: "queued",
      audience_count: messages?.length ?? 0,
      updated_at: now,
    })
    .eq("id", input.campaignId)
    .eq("founder_id", input.founderId)
    .select("*")
    .single();

  if (campaignError) {
    return { error: campaignError };
  }

  return { data: campaign as OutreachCampaignRecord };
}

export async function addOutreachMessage(
  supabase: SupabaseClient<Database>,
  input: {
    campaignId: string;
    contactId: string;
    subject: string;
    body: string;
  },
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .insert({
      campaign_id: input.campaignId,
      contact_id: input.contactId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as OutreachMessageRecord };
}

export async function listOutreachMessages(
  supabase: SupabaseClient<Database>,
  campaignId: string,
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .select("*, founder_investor_contacts(investor_name, email)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}

export async function listOutreachTargets(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}

export async function upsertOutreachTarget(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    contactId?: string | null;
    platformInvestorId?: string | null;
    matchScore?: number | null;
    status?: string;
    source?: string;
    notes?: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      contact_id: input.contactId ?? null,
      platform_investor_id: input.platformInvestorId ?? null,
      match_score: input.matchScore ?? null,
      status: input.status ?? "selected",
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data };
}

export async function listFollowUpDueContacts(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .select("id, next_follow_up_at, status, contact_id, platform_investor_id")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", now)
    .neq("status", "archived");

  if (error) {
    return { error };
  }

  return { data: data ?? [] };
}
